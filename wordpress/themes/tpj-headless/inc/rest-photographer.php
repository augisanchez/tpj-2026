<?php
/**
 * REST endpoints supporting the editorial photographer picker.
 * Namespaced under tpj/v1/. Permission for every route is
 * `edit_posts` — any author/editor/admin can use the picker.
 *
 * Registered routes:
 *   GET  tpj/v1/photographers/search?q=<name>&limit=<n>
 *   POST tpj/v1/photographers/create   { name, bio?, ...socials, atomic_combo? }
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

	register_rest_route( 'tpj/v1', '/photographers/create', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'tpj_rest_photographers_create',
		'permission_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
		'args' => [
			'name'           => [ 'type' => 'string', 'required' => true,  'sanitize_callback' => 'sanitize_text_field' ],
			'bio'            => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'wp_kses_post' ],
			'website'        => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'instagram'      => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'twitter'        => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'facebook'       => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'tumblr'         => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'flickr'         => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'vsco_grid'      => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'vimeo'          => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'blog'           => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'bluesky'        => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'threads'        => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'linkedin'       => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'tpj_location'   => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'represented_by' => [ 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ],
			'atomic_combo'   => [ 'type' => 'boolean', 'required' => false, 'default' => false ],
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

/**
 * Create a new Photographer CPT inline from the picker. Returns the
 * created row in the same shape as the search endpoint so the picker
 * can drop it straight into its `selected` list.
 *
 * Duplicate detection by slug: if a photographer with the same
 * sanitize_title(name) already exists in publish OR draft status,
 * returns 409 Conflict with the existing record's id/name/slug so
 * the picker can surface a "Did you mean…?" suggestion.
 *
 * Optional fields: bio (post_content), atomic_combo flag, and the
 * full social-meta set. All sanitized at the args layer above.
 */
function tpj_rest_photographers_create( WP_REST_Request $request ) {
	$name = trim( (string) $request->get_param( 'name' ) );
	if ( $name === '' ) {
		return new WP_Error( 'tpj_invalid_name', 'Name is required.', [ 'status' => 400 ] );
	}

	$slug = sanitize_title( $name );
	if ( $slug === '' ) {
		return new WP_Error( 'tpj_invalid_slug', 'Could not derive a slug from this name.', [ 'status' => 400 ] );
	}

	// Duplicate check. Photographers are unique by slug; if one
	// already exists (published or draft), refuse the create and tell
	// the client which existing record to use instead. Trashed records
	// don't block — their slugs have the __trashed suffix in WP.
	$existing = $GLOBALS['wpdb']->get_row( $GLOBALS['wpdb']->prepare(
		"SELECT ID, post_title, post_name FROM {$GLOBALS['wpdb']->posts}
		 WHERE post_type = 'photographer'
		   AND post_status IN ('publish','draft','pending','private')
		   AND post_name = %s
		 LIMIT 1",
		$slug
	) );
	if ( $existing ) {
		return new WP_Error(
			'tpj_duplicate_slug',
			sprintf( 'A photographer with the slug "%s" already exists.', $slug ),
			[
				'status'   => 409,
				'existing' => [
					'id'    => (int) $existing->ID,
					'name'  => $existing->post_title,
					'slug'  => $existing->post_name,
				],
			]
		);
	}

	$bio = (string) $request->get_param( 'bio' );

	$post_id = wp_insert_post( [
		'post_type'    => 'photographer',
		'post_status'  => 'publish',
		'post_title'   => $name,
		'post_name'    => $slug,
		'post_content' => $bio,
	], true );

	if ( is_wp_error( $post_id ) ) {
		return $post_id;
	}

	// Optional postmeta. Empty / missing values are skipped so we
	// don't seed a record with a bunch of empty meta_keys.
	$meta_fields = [
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
		'tpj_location',
	];
	foreach ( $meta_fields as $key ) {
		$value = (string) $request->get_param( $key );
		if ( $value !== '' ) {
			update_post_meta( $post_id, $key, $value );
		}
	}

	// represented_by maps to tpj_represented_by postmeta (the GraphQL
	// field is `representedBy`, the postmeta key carries the tpj_ prefix
	// to match the existing convention for editor-set fields).
	$represented_by = (string) $request->get_param( 'represented_by' );
	if ( $represented_by !== '' ) {
		update_post_meta( $post_id, 'tpj_represented_by', $represented_by );
	}

	if ( $request->get_param( 'atomic_combo' ) ) {
		update_post_meta( $post_id, 'tpj_atomic_combo', 1 );
	}

	$response = [
		'id'            => (int) $post_id,
		'name'          => $name,
		'slug'          => $slug,
		'portrait'      => null,
		'location'     => $request->get_param( 'tpj_location' ) ?: null,
		'atomic_combo' => (bool) $request->get_param( 'atomic_combo' ),
		'article_count' => 0,
	];

	return new WP_REST_Response( $response, 201 );
}
