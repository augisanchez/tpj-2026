<?php
/**
 * TPJ V2 taxonomy registrations.
 *
 * Four taxonomies replace the v1 site's flat category/tag system:
 *   - tpj-theme   editorial themes (Identity, Memory, Youth, etc.)
 *   - tpj-genre   genre conventions (Portraiture, Documentary, etc.)
 *   - tpj-medium  capture medium (Film, Digital, Mixed, Alt Process)
 *   - tpj-location free-form, editor-extended
 *
 * Initial Theme/Genre/Medium terms are seeded on first registration so the
 * editor doesn't have to type them in. Location stays empty.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_TAXONOMY_OBJECT_TYPES = [ 'essay', 'interview', 'feature' ];

add_action( 'init', function () {

	register_taxonomy( 'tpj-theme', TPJ_TAXONOMY_OBJECT_TYPES, [
		'label'               => 'Themes',
		'labels'              => [
			'name'          => 'Themes',
			'singular_name' => 'Theme',
			'menu_name'     => 'Themes',
		],
		'public'              => true,
		'hierarchical'        => false,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Theme',
		'graphql_plural_name' => 'Themes',
		'rewrite'             => [ 'slug' => 'theme' ],
	] );

	register_taxonomy( 'tpj-genre', TPJ_TAXONOMY_OBJECT_TYPES, [
		'label'               => 'Genres',
		'labels'              => [
			'name'          => 'Genres',
			'singular_name' => 'Genre',
			'menu_name'     => 'Genres',
		],
		'public'              => true,
		'hierarchical'        => false,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Genre',
		'graphql_plural_name' => 'Genres',
		'rewrite'             => [ 'slug' => 'genre' ],
	] );

	register_taxonomy( 'tpj-medium', TPJ_TAXONOMY_OBJECT_TYPES, [
		'label'               => 'Mediums',
		'labels'              => [
			'name'          => 'Mediums',
			'singular_name' => 'Medium',
			'menu_name'     => 'Mediums',
		],
		'public'              => true,
		'hierarchical'        => false,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Medium',
		'graphql_plural_name' => 'Mediums',
		'rewrite'             => [ 'slug' => 'medium' ],
	] );

	register_taxonomy( 'tpj-location', TPJ_TAXONOMY_OBJECT_TYPES, [
		'label'               => 'Locations',
		'labels'              => [
			'name'          => 'Locations',
			'singular_name' => 'Location',
			'menu_name'     => 'Locations',
		],
		'public'              => true,
		'hierarchical'        => false,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Location',
		'graphql_plural_name' => 'Locations',
		'rewrite'             => [ 'slug' => 'location' ],
	] );
} );

add_action( 'init', function () {
	$seeds = [
		'tpj-theme'  => [ 'Identity', 'Intimacy', 'Memory', 'Youth', 'Isolation', 'Place', 'Performance', 'Night', 'Desire', 'Labor', 'Family' ],
		'tpj-genre'  => [ 'Portraiture', 'Documentary', 'Street', 'Fashion', 'Fine Art', 'Still Life', 'Landscape', 'Experimental' ],
		'tpj-medium' => [ 'Film', 'Digital', 'Mixed', 'Alternative Process' ],
	];

	foreach ( $seeds as $taxonomy => $terms ) {
		foreach ( $terms as $term ) {
			if ( ! term_exists( $term, $taxonomy ) ) {
				wp_insert_term( $term, $taxonomy );
			}
		}
	}
}, 20 );
