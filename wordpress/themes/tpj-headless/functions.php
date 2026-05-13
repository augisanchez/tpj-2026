<?php
/**
 * TPJ Headless theme bootstrap.
 *
 * The frontend lives in Next.js. This theme exists only to model content
 * (CPTs, taxonomies, ACF fields) and expose it via WPGraphQL.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/inc/post-types.php';
require_once __DIR__ . '/inc/taxonomies.php';
require_once __DIR__ . '/inc/shortcodes.php';
require_once __DIR__ . '/inc/photographer-links.php';
require_once __DIR__ . '/inc/graphql.php';
require_once __DIR__ . '/inc/photographer-meta.php';
require_once __DIR__ . '/inc/photographer-admin.php';
require_once __DIR__ . '/inc/rest-photographer.php';
require_once __DIR__ . '/inc/article-panels.php';
require_once __DIR__ . '/inc/article-admin.php';
require_once __DIR__ . '/inc/upload-guardrails.php';
require_once __DIR__ . '/inc/cli.php';

/**
 * Flush rewrite rules on theme activation so newly registered CPT/taxonomy
 * routes work in the admin without requiring a manual visit to Settings >
 * Permalinks.
 */
add_action( 'after_switch_theme', function () {
	flush_rewrite_rules();
} );
