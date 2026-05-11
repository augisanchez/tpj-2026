<?php
/**
 * Labeled meta-box UI for the Photographer CPT.
 *
 * Photographer post meta is otherwise raw `wp_postmeta` (set by the
 * migration CLI), invisible to editors unless they enable Gutenberg's
 * generic Custom Fields panel and edit by key/value. This file adds a
 * proper labeled meta box so every editable field — portrait URL,
 * location, email, social links — has a real input.
 *
 * The Portrait URL field is paired with a WP media-library picker so
 * editors can upload an image (hosted in /wp-content/uploads/) directly
 * from this panel instead of pasting external URLs.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'add_meta_boxes_photographer', function () {
	add_meta_box(
		'tpj_photographer_details',
		'Photographer Details',
		'tpj_render_photographer_details_meta_box',
		'photographer',
		'normal',
		'high'
	);
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || $screen->post_type !== 'photographer' ) {
		return;
	}
	wp_enqueue_media();
} );

function tpj_render_photographer_details_meta_box( $post ) {
	wp_nonce_field( 'tpj_photographer_meta', 'tpj_photographer_meta_nonce' );

	$portrait_url  = get_post_meta( $post->ID, 'tpj_portrait_url', true );
	$atomic_combo  = (bool) get_post_meta( $post->ID, 'tpj_atomic_combo', true );

	$fields = [
		'tpj_location'        => [ 'label' => 'Location',       'type' => 'text',  'placeholder' => 'Los Angeles, California' ],
		'tpj_represented_by'  => [ 'label' => 'Represented by', 'type' => 'text',  'placeholder' => 'e.g. Wonderful Machine, Webber Represents' ],
		'tpj_email'           => [ 'label' => 'Email',          'type' => 'email', 'placeholder' => 'name@example.com' ],
		'website'      => [ 'label' => 'Website',   'type' => 'url',   'placeholder' => 'https://example.com' ],
		'instagram'    => [ 'label' => 'Instagram', 'type' => 'text',  'placeholder' => 'username or full URL' ],
		'twitter'      => [ 'label' => 'Twitter',   'type' => 'text',  'placeholder' => 'username or full URL' ],
		'facebook'     => [ 'label' => 'Facebook',  'type' => 'text',  'placeholder' => 'username or full URL' ],
		'tumblr'       => [ 'label' => 'Tumblr',    'type' => 'text',  'placeholder' => 'subdomain or full URL' ],
		'flickr'       => [ 'label' => 'Flickr',    'type' => 'text',  'placeholder' => 'username or full URL' ],
		'vsco_grid'    => [ 'label' => 'VSCO',      'type' => 'text',  'placeholder' => 'username or full URL' ],
		'vimeo'        => [ 'label' => 'Vimeo',     'type' => 'text',  'placeholder' => 'username or full URL' ],
		'blog'         => [ 'label' => 'Blog',      'type' => 'url',   'placeholder' => 'https://...' ],
		'bluesky'      => [ 'label' => 'Bluesky',   'type' => 'text',  'placeholder' => 'handle or full URL' ],
		'threads'      => [ 'label' => 'Threads',   'type' => 'text',  'placeholder' => 'username or full URL' ],
		'linkedin'     => [ 'label' => 'LinkedIn',  'type' => 'text',  'placeholder' => 'username or full URL' ],
	];

	echo '<style>
		.tpj-meta-portrait { margin: 0 0 24px; padding: 0 0 24px; border-bottom: 1px solid #e0e0e0; }
		.tpj-portrait-row { display: flex; gap: 16px; align-items: flex-start; }
		.tpj-portrait-preview {
			width: 120px; height: 150px; flex-shrink: 0;
			background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px;
			background-size: cover; background-position: center top;
			display: flex; align-items: center; justify-content: center;
			color: #999; font-size: 11px; text-align: center; padding: 8px;
		}
		.tpj-portrait-controls { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
		.tpj-portrait-controls label { font-weight: 600; }
		.tpj-portrait-controls input[type="url"] { width: 100%; }
		.tpj-portrait-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
		.tpj-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
		.tpj-meta-grid .tpj-meta-row { display: flex; flex-direction: column; gap: 4px; }
		.tpj-meta-grid label { font-weight: 600; }
		.tpj-meta-grid input[type="text"],
		.tpj-meta-grid input[type="email"],
		.tpj-meta-grid input[type="url"] { width: 100%; }
		.tpj-meta-note { color: #666; margin: 0 0 12px; }
		.tpj-meta-flag {
			margin: 0 0 20px; padding: 0 0 20px;
			border-bottom: 1px solid #e0e0e0;
		}
		.tpj-meta-flag label { font-weight: 600; }
		.tpj-meta-flag p { margin: 4px 0 0; color: #666; }
		@media (max-width: 782px) {
			.tpj-meta-grid { grid-template-columns: 1fr; }
		}
	</style>';

	echo '<div class="tpj-meta-portrait">';
	printf(
		'<div class="tpj-portrait-row">
			<div class="tpj-portrait-preview" id="tpj-portrait-preview"%1$s>%2$s</div>
			<div class="tpj-portrait-controls">
				<label for="tpj_field_tpj_portrait_url">Portrait Image</label>
				<p class="tpj-meta-note">Upload or pick from the media library. Files are hosted in WordPress (and will pick up any future CDN automatically). The frontend prefers the post\'s Featured Image first, then this URL.</p>
				<input type="url" id="tpj_field_tpj_portrait_url" name="tpj_portrait_url" value="%3$s" placeholder="https://..." />
				<div class="tpj-portrait-buttons">
					<button type="button" class="button button-primary" id="tpj-choose-portrait">Upload or choose image</button>
					<button type="button" class="button" id="tpj-clear-portrait">Clear</button>
				</div>
			</div>
		</div>',
		$portrait_url ? ' style="background-image:url(\'' . esc_url( $portrait_url ) . '\')"' : '',
		$portrait_url ? '' : 'No image set',
		esc_attr( $portrait_url )
	);
	echo '</div>';

	printf(
		'<div class="tpj-meta-flag">
			<label><input type="checkbox" name="tpj_atomic_combo" value="1"%1$s /> Treat as a single duo / collective (don\'t split on "&amp;")</label>
			<p>For brand-name pairs like "Anais &amp; Dax" or collectives, where the credit should resolve to this one record instead of two separate photographers.</p>
		</div>',
		$atomic_combo ? ' checked="checked"' : ''
	);

	echo '<div class="tpj-meta-grid">';
	foreach ( $fields as $key => $config ) {
		$value = get_post_meta( $post->ID, $key, true );
		printf(
			'<div class="tpj-meta-row"><label for="tpj_field_%1$s">%2$s</label><input type="%3$s" id="tpj_field_%1$s" name="%1$s" value="%4$s" placeholder="%5$s" /></div>',
			esc_attr( $key ),
			esc_html( $config['label'] ),
			esc_attr( $config['type'] ),
			esc_attr( $value ),
			esc_attr( $config['placeholder'] ?? '' )
		);
	}
	echo '</div>';

	?>
	<script>
	(function () {
		function init() {
			var btn = document.getElementById('tpj-choose-portrait');
			var clearBtn = document.getElementById('tpj-clear-portrait');
			var input = document.getElementById('tpj_field_tpj_portrait_url');
			var preview = document.getElementById('tpj-portrait-preview');
			if (!btn || !input || !preview || typeof wp === 'undefined' || !wp.media) return;

			function setPreview(url) {
				if (url) {
					preview.style.backgroundImage = 'url("' + url + '")';
					preview.textContent = '';
				} else {
					preview.style.backgroundImage = '';
					preview.textContent = 'No image set';
				}
			}

			btn.addEventListener('click', function (e) {
				e.preventDefault();
				var frame = wp.media({
					title: 'Select Portrait Image',
					button: { text: 'Use this image' },
					library: { type: 'image' },
					multiple: false
				});
				frame.on('select', function () {
					var attachment = frame.state().get('selection').first().toJSON();
					input.value = attachment.url;
					setPreview(attachment.url);
				});
				frame.open();
			});

			if (clearBtn) {
				clearBtn.addEventListener('click', function (e) {
					e.preventDefault();
					input.value = '';
					setPreview('');
				});
			}

			input.addEventListener('input', function () {
				setPreview(input.value);
			});
		}

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', init);
		} else {
			init();
		}
	})();
	</script>
	<?php
}

add_action( 'save_post_photographer', function ( $post_id, $post ) {
	if ( ! isset( $_POST['tpj_photographer_meta_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['tpj_photographer_meta_nonce'] ) ), 'tpj_photographer_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	$keys = [
		'tpj_location',
		'tpj_represented_by',
		'tpj_email',
		'website',
		'instagram',
		'twitter',
		'facebook',
		'tumblr',
		'flickr',
		'vsco_grid',
		'vimeo',
		'blog',
		'bluesky',
		'threads',
		'linkedin',
		'tpj_portrait_url',
	];

	foreach ( $keys as $key ) {
		if ( ! isset( $_POST[ $key ] ) ) {
			continue;
		}
		$value = sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
		if ( $value === '' ) {
			delete_post_meta( $post_id, $key );
		} else {
			update_post_meta( $post_id, $key, $value );
		}
	}

	// Checkbox: unchecked = no $_POST key, so handle outside the loop.
	if ( ! empty( $_POST['tpj_atomic_combo'] ) ) {
		update_post_meta( $post_id, 'tpj_atomic_combo', 1 );
	} else {
		delete_post_meta( $post_id, 'tpj_atomic_combo' );
	}
}, 10, 2 );
