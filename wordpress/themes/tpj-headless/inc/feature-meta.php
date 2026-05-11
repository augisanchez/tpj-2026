<?php
/**
 * Labeled meta-box UI for the Feature CPT.
 *
 * Adds editor inputs that aren't in the default WordPress post fields:
 *   - Writer: byline credit for written Features (book reviews, travel
 *     essays). Distinct from the photographer credit; both can appear
 *     in the article byline.
 *
 * Stored as `tpj_feature_writer` post meta. Exposed to GraphQL as
 * `Feature.tpjFeatureWriter` (see inc/graphql.php).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'add_meta_boxes_feature', function () {
	add_meta_box(
		'tpj_feature_details',
		'Feature Details',
		'tpj_render_feature_details_meta_box',
		'feature',
		'side',
		'default'
	);
} );

function tpj_render_feature_details_meta_box( $post ) {
	wp_nonce_field( 'tpj_feature_meta', 'tpj_feature_meta_nonce' );

	$writer = get_post_meta( $post->ID, 'tpj_feature_writer', true );

	echo '<style>
		.tpj-feature-meta-row { display: flex; flex-direction: column; gap: 6px; }
		.tpj-feature-meta-row label { font-weight: 600; }
		.tpj-feature-meta-row input { width: 100%; }
		.tpj-feature-meta-note { color: #666; font-size: 12px; margin: 0; }
	</style>';

	echo '<div class="tpj-feature-meta-row">';
	printf(
		'<label for="tpj_feature_writer">Writer</label>
		<p class="tpj-feature-meta-note">Byline name for written Features (book reviews, travel essays). Leave blank for photo-led Features.</p>
		<input type="text" id="tpj_feature_writer" name="tpj_feature_writer" value="%s" placeholder="Jane Doe" />',
		esc_attr( $writer )
	);
	echo '</div>';
}

add_action( 'save_post_feature', function ( $post_id ) {
	if ( ! isset( $_POST['tpj_feature_meta_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['tpj_feature_meta_nonce'] ) ), 'tpj_feature_meta' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	if ( isset( $_POST['tpj_feature_writer'] ) ) {
		$value = sanitize_text_field( wp_unslash( $_POST['tpj_feature_writer'] ) );
		if ( $value === '' ) {
			delete_post_meta( $post_id, 'tpj_feature_writer' );
		} else {
			update_post_meta( $post_id, 'tpj_feature_writer', $value );
		}
	}
}, 10, 1 );
