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
require_once __DIR__ . '/inc/editor-experience.php';
require_once __DIR__ . '/inc/r2-sync.php';
require_once __DIR__ . '/inc/cli.php';

/**
 * Flush rewrite rules on theme activation so newly registered CPT/taxonomy
 * routes work in the admin without requiring a manual visit to Settings >
 * Permalinks.
 */
add_action( 'after_switch_theme', function () {
	flush_rewrite_rules();
} );

/**
 * Send visitors who land on the WordPress host to the Next.js frontend.
 * Admin, login, GraphQL, REST, cron, and wp-cli pass through untouched.
 *
 * Opt-in: only runs when wp-config.php defines TPJ_FRONTEND_URL, e.g.
 *   define( 'TPJ_FRONTEND_URL', 'https://v2.thephotographicjournal.com' );
 * so local dev keeps its default behaviour.
 */
add_action( 'template_redirect', function () {
	if ( ! defined( 'TPJ_FRONTEND_URL' ) || ! TPJ_FRONTEND_URL ) {
		return;
	}
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || is_preview() ) {
		return;
	}
	if ( ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
		return;
	}
	if ( function_exists( 'is_graphql_http_request' ) && is_graphql_http_request() ) {
		return;
	}
	$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
	wp_redirect( untrailingslashit( TPJ_FRONTEND_URL ) . $path, 301 );
	exit;
} );
