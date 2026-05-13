<?php
/**
 * Upload guardrails for the editorial team.
 *
 * Hooks `wp_handle_upload_prefilter` (fires for every upload path:
 * Media Library, Featured Image picker, Gutenberg inline, REST API)
 * and enforces:
 *
 * Images
 *  - Allowed mime types: JPEG, PNG, WebP. Rejects everything else
 *    (HEIC, RAW, PSD, TIFF, BMP, GIF) — the frontend pipeline isn't
 *    set up to handle those and they'd ship as-is.
 *  - Hard cap on file size at 15 MB. Rejects.
 *  - Auto-resize anything larger than 3000px on the longest side
 *    using WP's built-in image editor. Preserves aspect ratio.
 *    Editor still uploads whatever they had on disk; the pipeline
 *    normalizes silently.
 *
 * Videos
 *  - Allowed mime type: video/mp4 only. Rejects MOV, AVI, MKV, WebM.
 *    H.264 / AAC inside MP4 is what every browser plays without a
 *    transcoding step; other containers either don't play
 *    universally or need transcoding work we haven't built.
 *  - Hard cap on file size at 50 MB. Rejects.
 *  - Duration / resolution caps not enforced server-side (would
 *    need ffprobe). Documented as an editorial expectation: keep
 *    inline clips under ~60s and at 1080p or below.
 *
 * Notices: when we auto-resize an image, we stash a per-user
 * transient with the before/after dimensions and surface it as
 * an `admin_notices` banner on the next admin page load. Editors
 * see what happened to their upload without having to read logs.
 *
 * Long-term: pairs with a Cloudflare-fronted media origin + URL-
 * based transforms (Cloudflare Image Resizing) for delivery. See
 * project_tpj_v2_deferred_work.md for the full responsive strategy.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_UPLOAD_ALLOWED_IMAGE_MIMES = [
	'image/jpeg',
	'image/png',
	'image/webp',
];

const TPJ_UPLOAD_ALLOWED_VIDEO_MIMES = [
	'video/mp4',
];

// Hard caps. Anything over rejects with an editor-facing error.
const TPJ_UPLOAD_MAX_IMAGE_BYTES = 15 * 1024 * 1024;  // 15 MB
const TPJ_UPLOAD_MAX_VIDEO_BYTES = 50 * 1024 * 1024;  // 50 MB

// Soft cap. Images larger than this on the longest side get
// auto-resized to fit. 3000px covers a 2x retina display at full-
// bleed hero scale; anything larger is bandwidth waste.
const TPJ_UPLOAD_IMAGE_MAX_DIMENSION = 3000;

add_filter( 'wp_handle_upload_prefilter', 'tpj_upload_guardrail' );

function tpj_upload_guardrail( $file ) {
	if ( empty( $file['type'] ) || ! empty( $file['error'] ) ) {
		return $file;
	}

	$mime    = (string) $file['type'];
	$is_image = strpos( $mime, 'image/' ) === 0;
	$is_video = strpos( $mime, 'video/' ) === 0;

	// Block anything that isn't image or video at the source. The
	// editorial team uploads photos and (occasionally) clips; we
	// don't want stray PDFs / docs / audio landing in uploads.
	if ( ! $is_image && ! $is_video ) {
		$file['error'] = sprintf(
			'File type %s is not allowed. Allowed: JPEG, PNG, WebP, MP4.',
			$mime
		);
		return $file;
	}

	// Mime allow-list per category.
	$allowed = $is_image
		? TPJ_UPLOAD_ALLOWED_IMAGE_MIMES
		: TPJ_UPLOAD_ALLOWED_VIDEO_MIMES;
	if ( ! in_array( $mime, $allowed, true ) ) {
		$category = $is_image ? 'image' : 'video';
		$file['error'] = sprintf(
			'%s type %s is not allowed. Use %s.',
			ucfirst( $category ),
			$mime,
			$is_image ? 'JPEG, PNG, or WebP' : 'MP4 (H.264)'
		);
		return $file;
	}

	// File size caps.
	$max_size = $is_image
		? TPJ_UPLOAD_MAX_IMAGE_BYTES
		: TPJ_UPLOAD_MAX_VIDEO_BYTES;
	if ( ! empty( $file['size'] ) && $file['size'] > $max_size ) {
		$file['error'] = sprintf(
			'File is %s. Maximum %s allowed: %s.',
			size_format( $file['size'] ),
			$is_image ? 'image' : 'video',
			size_format( $max_size )
		);
		return $file;
	}

	// Auto-resize oversized images in place. We modify the temp
	// file at $file['tmp_name'] before WP moves it to its final
	// home in wp-content/uploads/. WP's downstream metadata + the
	// generated size variants then derive from the resized source.
	if ( $is_image ) {
		$info = @getimagesize( $file['tmp_name'] );
		if ( $info !== false ) {
			$width  = (int) $info[0];
			$height = (int) $info[1];
			$longest = max( $width, $height );

			if ( $longest > TPJ_UPLOAD_IMAGE_MAX_DIMENSION ) {
				$editor = wp_get_image_editor( $file['tmp_name'] );
				if ( ! is_wp_error( $editor ) ) {
					// resize() with both dims set to the same cap and
					// $crop = false preserves aspect: it sizes to fit
					// inside the box (so longest side becomes the cap,
					// shorter side scales proportionally).
					$editor->resize(
						TPJ_UPLOAD_IMAGE_MAX_DIMENSION,
						TPJ_UPLOAD_IMAGE_MAX_DIMENSION,
						false
					);
					$saved = $editor->save( $file['tmp_name'] );

					if ( ! is_wp_error( $saved ) ) {
						// Update the file's reported size after the
						// resize — the post-save filesize is smaller.
						clearstatcache( true, $file['tmp_name'] );
						$file['size'] = filesize( $file['tmp_name'] );

						// Queue an admin notice for the next page
						// load so the editor sees what happened.
						tpj_queue_upload_notice(
							sprintf(
								'%s was resized from %d×%d to fit %dpx on the longest side.',
								esc_html( $file['name'] ),
								$width,
								$height,
								TPJ_UPLOAD_IMAGE_MAX_DIMENSION
							)
						);
					}
				}
			}
		}
	}

	return $file;
}

/**
 * Per-user transient that buffers upload notices. The next admin
 * page load reads and clears it.
 */
function tpj_queue_upload_notice( $message ) {
	$user_id = get_current_user_id();
	if ( ! $user_id ) {
		return;
	}
	$key = 'tpj_upload_notices_' . $user_id;
	$pending = get_transient( $key );
	if ( ! is_array( $pending ) ) {
		$pending = [];
	}
	$pending[] = $message;
	// 5 minutes is plenty — the next page load consumes it.
	set_transient( $key, $pending, 5 * MINUTE_IN_SECONDS );
}

add_action( 'admin_notices', function () {
	$user_id = get_current_user_id();
	if ( ! $user_id ) {
		return;
	}
	$key = 'tpj_upload_notices_' . $user_id;
	$pending = get_transient( $key );
	if ( empty( $pending ) || ! is_array( $pending ) ) {
		return;
	}
	delete_transient( $key );

	foreach ( $pending as $msg ) {
		printf(
			'<div class="notice notice-info is-dismissible"><p><strong>TPJ uploads:</strong> %s</p></div>',
			esc_html( $msg )
		);
	}
} );
