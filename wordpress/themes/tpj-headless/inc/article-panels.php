<?php
/**
 * Gutenberg sidebar panels for essay / interview / feature edit
 * screens. Replaces the classic meta boxes in
 * inc/article-meta.php (Intro) and inc/feature-meta.php (Writer)
 * with native-feeling panels that live in the document settings
 * sidebar alongside Status, Featured Image, Categories, etc.
 *
 * Two panels per CPT:
 *   1. "Article details"
 *        - Intro / lede textarea (all three CPTs)
 *        - Byline author text input — labeled "Writer" on Feature,
 *          "Interviewer" on Interview, hidden on Essay
 *   2. "Hero image"
 *        - Media-library picker. Stored as `_tpj_hero_image_id`.
 *        - Frontend resolver falls back to legacy v1 `header_image`
 *          ACF postmeta and then to `_thumbnail_id` (WP featured)
 *          if unset, so this only needs to be set when the editor
 *          wants a different image from the featured.
 *
 * Editors can collapse panels and reorder them via Preferences.
 * All saves go through the REST API; no PHP form-submit handlers.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_ARTICLE_PANEL_POST_TYPES = [ 'essay', 'interview', 'feature' ];

/**
 * Postmeta key for the byline author. Unified across Interview
 * (interviewer credit) and Feature (writer credit). Migrated from
 * the legacy `tpj_feature_writer` key via `wp tpj migrate-byline-author`.
 */
const TPJ_BYLINE_AUTHOR_META_KEY = 'tpj_byline_author';

/**
 * Postmeta key for the hero image override. Attachment ID.
 * Underscore prefix hides it from the legacy Custom Fields UI but
 * still exposes it via REST since we pass an auth callback.
 */
const TPJ_HERO_IMAGE_META_KEY = '_tpj_hero_image_id';

/**
 * Postmeta key for the editorial staff-pick flag. Boolean.
 * Influences both the homepage hero carousel (one of three slides
 * is a staff-picked article) and the Dive Deeper section's weighted
 * selection.
 */
const TPJ_STAFF_PICK_META_KEY = 'tpj_staff_pick';

add_action( 'init', 'tpj_register_article_panel_meta' );

function tpj_register_article_panel_meta() {
	$auth_callback = function () {
		return current_user_can( 'edit_posts' );
	};

	foreach ( TPJ_ARTICLE_PANEL_POST_TYPES as $type ) {
		register_post_meta( $type, 'intro', [
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_textarea_field',
			'auth_callback'     => $auth_callback,
		] );

		register_post_meta( $type, TPJ_BYLINE_AUTHOR_META_KEY, [
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => $auth_callback,
		] );

		register_post_meta( $type, TPJ_HERO_IMAGE_META_KEY, [
			'type'              => 'integer',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => 'absint',
			'auth_callback'     => $auth_callback,
		] );

		register_post_meta( $type, TPJ_STAFF_PICK_META_KEY, [
			'type'              => 'boolean',
			'single'            => true,
			'show_in_rest'      => true,
			'sanitize_callback' => function ( $v ) {
				return $v ? 1 : 0;
			},
			'auth_callback'     => $auth_callback,
		] );
	}
}

/**
 * Enqueue the sidebar-panel JS bundle on the block-editor edit
 * screen for the three CPTs. The asset file pattern follows the
 * existing photographer-picker script — plain JS using wp.* globals,
 * no build step.
 */
add_action( 'enqueue_block_editor_assets', 'tpj_enqueue_article_panels' );

function tpj_enqueue_article_panels() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || ! in_array( $screen->post_type, TPJ_ARTICLE_PANEL_POST_TYPES, true ) ) {
		return;
	}

	$rel  = 'assets/article-panels.js';
	$path = get_stylesheet_directory() . '/' . $rel;
	$url  = get_stylesheet_directory_uri() . '/' . $rel;

	wp_enqueue_script(
		'tpj-article-panels',
		$url,
		[
			'wp-plugins',
			'wp-edit-post',
			'wp-element',
			'wp-components',
			'wp-data',
			'wp-block-editor',
			'wp-i18n',
		],
		file_exists( $path ) ? filemtime( $path ) : null,
		true
	);
}
