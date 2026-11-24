<?php
/**
 * Plugin Name: TPJ hardening
 * Description: Headless-CMS hardening from the 2026-11-24 site audit (M8, L8, M9). The public site reads WordPress only through /graphql, so anonymous visitors don't need user listings, version strings or the REST index.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* M8: no user listing for anonymous requests (slugs + Gravatar hashes). */
add_filter( 'rest_endpoints', function ( $endpoints ) {
	if ( is_user_logged_in() ) {
		return $endpoints;
	}
	foreach ( array_keys( $endpoints ) as $route ) {
		if ( strpos( $route, '/wp/v2/users' ) === 0 ) {
			unset( $endpoints[ $route ] );
		}
	}
	return $endpoints;
} );

/* M8: ?author=N must not reveal a login slug by redirecting to it. */
add_action( 'template_redirect', function () {
	if ( ! is_user_logged_in() && ( isset( $_GET['author'] ) || is_author() ) ) {
		status_header( 404 );
		nocache_headers();
		exit;
	}
}, 1 );

/* M8: hide the REST route index from anonymous visitors. Routes still work. */
add_filter( 'rest_index', function ( $response ) {
	if ( is_user_logged_in() ) {
		return $response;
	}
	return new WP_REST_Response( [ 'name' => get_bloginfo( 'name' ) ], 200 );
}, 9999 );

/* L8: no WordPress version in markup, feeds or core asset URLs. */
remove_action( 'wp_head', 'wp_generator' );
add_filter( 'the_generator', '__return_empty_string' );
$tpj_strip_ver = function ( $src ) {
	global $wp_version;
	if ( is_string( $src ) && strpos( $src, 'ver=' . $wp_version ) !== false ) {
		$src = remove_query_arg( 'ver', $src );
	}
	return $src;
};
add_filter( 'style_loader_src', $tpj_strip_ver, 9999 );
add_filter( 'script_loader_src', $tpj_strip_ver, 9999 );

/* M9: "Suggest tags" calls a paid AI API. Cap each editor at 30 calls an
   hour so a stuck script or stolen session can't run up the bill. */
add_filter( 'rest_pre_dispatch', function ( $result, $server, $request ) {
	if ( $request->get_route() !== '/tpj/v1/suggest-tags' ) {
		return $result;
	}
	$user = get_current_user_id();
	if ( ! $user ) {
		return $result; // permission_callback rejects it.
	}
	$key   = 'tpj_suggest_rl_' . $user;
	$count = (int) get_transient( $key );
	if ( $count >= 30 ) {
		return new WP_Error( 'tpj_rate_limited', 'Tag suggestions are limited to 30 an hour. Try again later.', [ 'status' => 429 ] );
	}
	set_transient( $key, $count + 1, HOUR_IN_SECONDS );
	return $result;
}, 10, 3 );
