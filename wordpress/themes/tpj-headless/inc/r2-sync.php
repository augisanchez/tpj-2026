<?php
/**
 * Copy uploads (original + every generated size) to the Cloudflare R2
 * media bucket, so the site serves them through the image CDN like the
 * archive. Add-only: never deletes from R2.
 *
 * Covers every way a file lands in uploads:
 *  - New uploads (Media Library, featured image, block editor, REST).
 *  - Edits in WordPress's image editor (crop, rotate, scale, flip),
 *    which write new "-e<timestamp>" files without re-running upload
 *    hooks. Missing these broke edited portraits on the site.
 *  - Sizes WordPress adds later (regenerated thumbnails).
 *
 * Each attachment remembers which files reached R2 (_tpj_r2_synced),
 * so every metadata save pushes only what's new. A failed copy marks
 * the attachment pending (_tpj_r2_pending), shows an admin notice, and
 * is retried by a cron job every 15 minutes. That job also re-checks
 * recently changed files on disk against R2 as a safety net.
 *
 * wp-config constants (feature off without them):
 *   TPJ_R2_ENDPOINT  https://<account>.r2.cloudflarestorage.com
 *   TPJ_R2_KEY / TPJ_R2_SECRET   R2 API token (Object Read & Write, tpj-media)
 *   TPJ_R2_BUCKET    tpj-media
 *   TPJ_R2_PREFIX    tpj/wp-content/uploads/
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function tpj_r2_enabled() {
	foreach ( [ 'TPJ_R2_ENDPOINT', 'TPJ_R2_KEY', 'TPJ_R2_SECRET', 'TPJ_R2_BUCKET', 'TPJ_R2_PREFIX' ] as $c ) {
		if ( ! defined( $c ) || ! constant( $c ) ) {
			return false;
		}
	}
	return true;
}

/**
 * One signed request to R2 (AWS Signature V4, region "auto").
 * Returns the HTTP status code, or 0 on a transport error.
 */
function tpj_r2_request( $method, $key, $body = '', $type = '' ) {
	$host    = wp_parse_url( TPJ_R2_ENDPOINT, PHP_URL_HOST );
	$path    = '/' . TPJ_R2_BUCKET . '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $key ) ) );
	$now     = gmdate( 'Ymd\THis\Z' );
	$date    = substr( $now, 0, 8 );
	$hash    = hash( 'sha256', $body );
	$headers = [ 'host' => $host, 'x-amz-content-sha256' => $hash, 'x-amz-date' => $now ];
	if ( $type ) {
		$headers['content-type'] = $type;
	}
	ksort( $headers );
	$canon_h = '';
	foreach ( $headers as $k => $v ) {
		$canon_h .= $k . ':' . trim( $v ) . "\n";
	}
	$signed  = implode( ';', array_keys( $headers ) );
	$request = "{$method}\n{$path}\n\n{$canon_h}\n{$signed}\n{$hash}";
	$scope   = "{$date}/auto/s3/aws4_request";
	$to_sign = "AWS4-HMAC-SHA256\n{$now}\n{$scope}\n" . hash( 'sha256', $request );
	$k       = hash_hmac( 'sha256', 'aws4_request', hash_hmac( 'sha256', 's3', hash_hmac( 'sha256', 'auto', hash_hmac( 'sha256', $date, 'AWS4' . TPJ_R2_SECRET, true ), true ), true ), true );
	$sig     = hash_hmac( 'sha256', $to_sign, $k );
	$send    = [
		'x-amz-content-sha256' => $hash,
		'x-amz-date'           => $now,
		'Authorization'        => "AWS4-HMAC-SHA256 Credential=" . TPJ_R2_KEY . "/{$scope}, SignedHeaders={$signed}, Signature={$sig}",
	];
	if ( $type ) {
		$send['Content-Type'] = $type;
	}
	$res = wp_remote_request( 'https://' . $host . $path, [
		'method'  => $method,
		'timeout' => 'PUT' === $method ? 60 : 15,
		'body'    => 'PUT' === $method ? $body : null,
		'headers' => $send,
	] );
	return is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
}

/** PUT one local file to R2. True on success. */
function tpj_r2_put( $local_path, $key ) {
	if ( ! is_readable( $local_path ) ) {
		return false;
	}
	$type = wp_check_filetype( $local_path )['type'] ?: 'application/octet-stream';
	return 200 === tpj_r2_request( 'PUT', $key, file_get_contents( $local_path ), $type );
}

/** True when the object is already in R2. */
function tpj_r2_exists( $key ) {
	return 200 === tpj_r2_request( 'HEAD', $key );
}

/** Every file an attachment's metadata points at, relative to uploads. */
function tpj_r2_attachment_files( $meta, $attachment_id ) {
	$rel = ! empty( $meta['file'] ) ? $meta['file'] : get_post_meta( $attachment_id, '_wp_attached_file', true );
	if ( ! $rel ) {
		return [];
	}
	$dir   = dirname( $rel );
	$dir   = ( '.' === $dir || '' === $dir ) ? '' : trailingslashit( $dir );
	$files = [ $rel ];
	if ( ! empty( $meta['original_image'] ) ) {
		$files[] = $dir . $meta['original_image'];
	}
	foreach ( (array) ( $meta['sizes'] ?? [] ) as $size ) {
		if ( ! empty( $size['file'] ) ) {
			$files[] = $dir . $size['file'];
		}
	}
	return array_values( array_unique( $files ) );
}

/**
 * Push whatever this attachment has that R2 doesn't yet. Returns the
 * files that failed (empty when everything is there).
 */
function tpj_r2_sync_attachment( $attachment_id, $meta = null ) {
	if ( ! tpj_r2_enabled() ) {
		return [];
	}
	if ( null === $meta ) {
		$meta = wp_get_attachment_metadata( $attachment_id );
	}
	$uploads = wp_get_upload_dir();
	$synced  = (array) get_post_meta( $attachment_id, '_tpj_r2_synced', true );
	$failed  = [];
	foreach ( tpj_r2_attachment_files( (array) $meta, $attachment_id ) as $rel ) {
		if ( in_array( $rel, $synced, true ) ) {
			continue;
		}
		$local = trailingslashit( $uploads['basedir'] ) . $rel;
		if ( ! file_exists( $local ) ) {
			// WordPress writes sizes one by one and saves metadata between
			// them; a size listed before its file exists is caught on the
			// next save or by the cron retry.
			$failed[] = $rel;
			continue;
		}
		if ( tpj_r2_put( $local, TPJ_R2_PREFIX . ltrim( $rel, '/' ) ) ) {
			$synced[] = $rel;
		} else {
			$failed[] = $rel;
		}
	}
	update_post_meta( $attachment_id, '_tpj_r2_synced', array_values( array_unique( $synced ) ) );
	if ( $failed ) {
		update_post_meta( $attachment_id, '_tpj_r2_pending', time() );
	} else {
		delete_post_meta( $attachment_id, '_tpj_r2_pending' );
	}
	return $failed;
}

// New uploads: WordPress has generated every size.
add_filter( 'wp_generate_attachment_metadata', function ( $meta, $attachment_id ) {
	tpj_r2_sync_attachment( $attachment_id, $meta );
	return $meta;
}, 20, 2 );

// Every later metadata save: image-editor edits, added sizes. Only
// files not yet in R2 are sent.
add_filter( 'wp_update_attachment_metadata', function ( $meta, $attachment_id ) {
	$failed = tpj_r2_sync_attachment( $attachment_id, $meta );
	if ( $failed && is_admin() ) {
		tpj_r2_note_failure( $attachment_id );
	}
	return $meta;
}, 20, 2 );

/** Tell the editor once, on their next admin page, and log it. */
function tpj_r2_note_failure( $attachment_id ) {
	error_log( 'tpj r2-sync: pending for attachment ' . $attachment_id );
	if ( function_exists( 'tpj_queue_upload_notice' ) ) {
		tpj_queue_upload_notice( sprintf(
			'%s is saved, but copying it to the image server didn’t finish. It retries automatically within 15 minutes; until then it may not show on the site.',
			get_the_title( $attachment_id ) ?: 'An image'
		) );
	}
}

// Retry and safety-net job, every 15 minutes.
add_filter( 'cron_schedules', function ( $s ) {
	$s['tpj_quarter_hour'] = [ 'interval' => 15 * MINUTE_IN_SECONDS, 'display' => 'Every 15 minutes' ];
	return $s;
} );
add_action( 'init', function () {
	if ( tpj_r2_enabled() && ! wp_next_scheduled( 'tpj_r2_reconcile' ) ) {
		wp_schedule_event( time() + 60, 'tpj_quarter_hour', 'tpj_r2_reconcile' );
	}
} );
add_action( 'tpj_r2_reconcile', 'tpj_r2_reconcile' );

/**
 * 1. Retry attachments marked pending.
 * 2. Check every uploads file changed in the last $days against R2 and
 *    copy any that are missing (covers anything a hook didn't see).
 * Returns counts for the CLI.
 */
function tpj_r2_reconcile( $days = 3 ) {
	if ( ! tpj_r2_enabled() ) {
		return [ 'retried' => 0, 'checked' => 0, 'copied' => 0, 'failed' => 0 ];
	}
	$out     = [ 'retried' => 0, 'checked' => 0, 'copied' => 0, 'failed' => 0 ];
	$pending = get_posts( [
		'post_type'      => 'attachment',
		'post_status'    => 'any',
		'meta_key'       => '_tpj_r2_pending',
		'fields'         => 'ids',
		'posts_per_page' => 200,
	] );
	foreach ( $pending as $id ) {
		$out['retried']++;
		tpj_r2_sync_attachment( $id );
	}

	$base  = trailingslashit( wp_get_upload_dir()['basedir'] );
	$since = time() - (int) $days * DAY_IN_SECONDS;
	if ( ! is_dir( $base ) ) {
		return $out;
	}
	$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $base, FilesystemIterator::SKIP_DOTS ) );
	foreach ( $it as $file ) {
		if ( ! $file->isFile() || $file->getMTime() < $since ) {
			continue;
		}
		$rel = ltrim( substr( $file->getPathname(), strlen( $base ) ), '/' );
		if ( preg_match( '/\.(php|htaccess|ini|log)$/i', $rel ) ) {
			continue;
		}
		$out['checked']++;
		$key = TPJ_R2_PREFIX . $rel;
		if ( tpj_r2_exists( $key ) ) {
			continue;
		}
		if ( tpj_r2_put( $file->getPathname(), $key ) ) {
			$out['copied']++;
		} else {
			$out['failed']++;
			error_log( 'tpj r2-sync: reconcile could not copy ' . $rel );
		}
	}
	return $out;
}

// Media screen: one line showing whether the image is on the image server.
add_filter( 'attachment_fields_to_edit', function ( $fields, $post ) {
	if ( ! tpj_r2_enabled() || ! wp_attachment_is_image( $post->ID ) ) {
		return $fields;
	}
	$pending = get_post_meta( $post->ID, '_tpj_r2_pending', true );
	$fields['tpj_r2_status'] = [
		'label' => 'Image server',
		'input' => 'html',
		'html'  => $pending
			? '<span style="color:#b32d2e">Copy pending, retrying automatically.</span>'
			: '<span>Copied. Ready for the site.</span>',
	];
	return $fields;
}, 10, 2 );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	/**
	 * wp tpj-r2 reconcile [--days=<n>]
	 * Retry pending attachments and copy any recent uploads missing from R2.
	 */
	WP_CLI::add_command( 'tpj-r2 reconcile', function ( $args, $assoc ) {
		$r = tpj_r2_reconcile( (int) ( $assoc['days'] ?? 3 ) );
		WP_CLI::success( sprintf( 'retried %d, checked %d, copied %d, failed %d', $r['retried'], $r['checked'], $r['copied'], $r['failed'] ) );
	} );
}
