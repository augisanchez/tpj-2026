<?php
/**
 * Lean meta box for essay / interview / feature edit screens.
 *
 * Replaces the legacy "Foreward / Intro" ACF field group. The
 * original group bundled five fields (intro, interviewer, photographer,
 * names_3, names_4); only `intro` remains editorially relevant in V2:
 *
 *   - `interviewer` text-credit is composed automatically from the
 *     linked photographer + date in the byline renderer; editors
 *     don't set it manually on new content.
 *   - `photographer` text-credit is derived from the picker's
 *     selection (inc/photographer-admin.php save handler joins names
 *     with " & ") — also no manual editor field.
 *   - `names_3` / `names_4` were v1 sparse fields (16 + 20 records).
 *     The picker's multi-photographer + drag-reorder workflow
 *     replaces them. Legacy data stays in postmeta for the existing
 *     records; no new entries need the field.
 *
 * What's left for editors is just the lede paragraph (`intro`),
 * read by graphql.php's `articleIntro` field and rendered at the top
 * of the article between hero and body. One textarea, no ceremony.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_ARTICLE_META_POST_TYPES = [ 'essay', 'interview', 'feature' ];

add_action( 'add_meta_boxes', function () {
	foreach ( TPJ_ARTICLE_META_POST_TYPES as $type ) {
		add_meta_box(
			'tpj_article_intro',
			'Article Intro / Lede',
			'tpj_render_article_intro_meta_box',
			$type,
			'normal',
			'high'
		);
	}
} );

function tpj_render_article_intro_meta_box( $post ) {
	wp_nonce_field( 'tpj_article_intro', 'tpj_article_intro_nonce' );
	$value = get_post_meta( $post->ID, 'intro', true );
	?>
	<p class="description" style="margin: 0 0 8px;">
		Lede paragraph shown between the article hero and the body
		content. Plain text; line breaks become paragraph breaks.
	</p>
	<textarea
		name="tpj_article_intro"
		rows="4"
		style="width: 100%; font-family: inherit;"
	><?php echo esc_textarea( $value ); ?></textarea>
	<?php
}

add_action( 'save_post', function ( $post_id, $post ) {
	if ( ! in_array( $post->post_type, TPJ_ARTICLE_META_POST_TYPES, true ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( wp_is_post_revision( $post_id ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	if ( ! isset( $_POST['tpj_article_intro_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce(
		sanitize_text_field( wp_unslash( $_POST['tpj_article_intro_nonce'] ) ),
		'tpj_article_intro'
	) ) {
		return;
	}

	if ( isset( $_POST['tpj_article_intro'] ) ) {
		$value = wp_unslash( $_POST['tpj_article_intro'] );
		$value = sanitize_textarea_field( $value );
		if ( trim( $value ) !== '' ) {
			update_post_meta( $post_id, 'intro', $value );
		} else {
			delete_post_meta( $post_id, 'intro' );
		}
	}
}, 10, 2 );
