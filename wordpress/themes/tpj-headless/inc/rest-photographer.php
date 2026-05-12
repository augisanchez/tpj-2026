<?php
/**
 * REST endpoints supporting the editorial photographer picker.
 * Namespaced under tpj/v1/. Permission for every route is
 * `edit_posts` — any author/editor/admin can use the picker.
 *
 * Currently registered:
 *   GET  tpj/v1/photographers/search?q=<name>&limit=<n>
 *
 * Planned (see project_tpj_editorial_picker.md):
 *   POST tpj/v1/photographers/create
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'rest_api_init', function () {
	register_rest_route( 'tpj/v1', '/photographers/search', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'tpj_rest_photographers_search',
		'permission_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
		'args' => [
			'q' => [
				'type'              => 'string',
				'required'          => false,
				'default'           => '',
				'sanitize_callback' => 'sanitize_text_field',
			],
			'limit' => [
				'type'              => 'integer',
				'required'          => false,
				'default'           => 20,
				'sanitize_callback' => 'absint',
			],
		],
	] );
} );

/**
 * Photographer search for the picker. Matches on:
 *   - post_title (LIKE %q%)
 *   - post_name / slug (LIKE %sanitize_title(q)%)
 *   - instagram postmeta (LIKE %q%) — so editors can find "@jtrav"
 *   - website postmeta (LIKE %q%) — same idea for "jasontravisphoto.com"
 *
 * Ordering prefers title prefix matches first, then falls back to
 * alphabetical. Empty `q` returns the first N photographers
 * alphabetically so the picker has something to display when freshly
 * opened.
 *
 * Result shape (per row):
 *   {
 *     id            : int      — photographer post ID
 *     name          : string   — post_title
 *     slug          : string   — post_name (URL slug)
 *     portrait      : string|null — tpj_portrait_url postmeta if set
 *     location      : string|null — tpj_location postmeta
 *     atomic_combo  : boolean  — tpj_atomic_combo flag (for duos/collectives)
 *     article_count : int      — number of articles that link this CPT
 *                                via tpj_photographer postmeta
 *   }
 */
function tpj_rest_photographers_search( WP_REST_Request $request ) {
	global $wpdb;

	$q     = trim( (string) $request->get_param( 'q' ) );
	$limit = max( 1, min( 50, (int) $request->get_param( 'limit' ) ) );

	if ( $q === '' ) {
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT p.ID, p.post_title, p.post_name
			 FROM {$wpdb->posts} p
			 WHERE p.post_type = 'photographer'
			   AND p.post_status = 'publish'
			 ORDER BY p.post_title ASC
			 LIMIT %d",
			$limit
		) );
	} else {
		$like      = '%' . $wpdb->esc_like( $q ) . '%';
		$slug_like = '%' . $wpdb->esc_like( sanitize_title( $q ) ) . '%';
		$prefix    = $wpdb->esc_like( $q ) . '%';

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT DISTINCT p.ID, p.post_title, p.post_name
			 FROM {$wpdb->posts} p
			 LEFT JOIN {$wpdb->postmeta} mi
			   ON mi.post_id = p.ID AND mi.meta_key = 'instagram'
			 LEFT JOIN {$wpdb->postmeta} mw
			   ON mw.post_id = p.ID AND mw.meta_key = 'website'
			 WHERE p.post_type = 'photographer'
			   AND p.post_status = 'publish'
			   AND (
			       p.post_title LIKE %s
			    OR p.post_name LIKE %s
			    OR mi.meta_value LIKE %s
			    OR mw.meta_value LIKE %s
			   )
			 ORDER BY
			   CASE WHEN p.post_title LIKE %s THEN 0 ELSE 1 END,
			   p.post_title ASC
			 LIMIT %d",
			$like,
			$slug_like,
			$like,
			$like,
			$prefix,
			$limit
		) );
	}

	$results = [];
	foreach ( $rows as $r ) {
		$id = (int) $r->ID;

		$article_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->postmeta}
			 WHERE meta_key = 'tpj_photographer'
			   AND meta_value = %s",
			(string) $id
		) );

		$portrait = get_post_meta( $id, 'tpj_portrait_url', true );
		$location = get_post_meta( $id, 'tpj_location', true );

		$results[] = [
			'id'            => $id,
			'name'          => $r->post_title,
			'slug'          => $r->post_name,
			'portrait'      => $portrait !== '' ? $portrait : null,
			'location'      => $location !== '' ? $location : null,
			'atomic_combo'  => (bool) get_post_meta( $id, 'tpj_atomic_combo', true ),
			'article_count' => $article_count,
		];
	}

	return new WP_REST_Response( $results, 200 );
}
