<?php
/**
 * TPJ V2 custom post type registrations.
 *
 * Existing CPTs (essay, interview, feature) match the v1 production database
 * so the imported rows appear under the new admin menus immediately. The two
 * new CPTs (photographer, collection) start empty and are populated by the
 * migration scripts described in Build Plan §migration sequence.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', function () {

	register_post_type( 'essay', [
		'label'               => 'Essays',
		'labels'              => [
			'name'          => 'Essays',
			'singular_name' => 'Essay',
			'add_new_item'  => 'Add New Essay',
			'edit_item'     => 'Edit Essay',
			'all_items'     => 'All Essays',
			'menu_name'     => 'Essays',
		],
		'public'              => true,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Essay',
		'graphql_plural_name' => 'Essays',
		'menu_position'       => 5,
		'menu_icon'           => 'dashicons-format-image',
		'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ],
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'essays', 'with_front' => false ],
	] );

	register_post_type( 'interview', [
		'label'               => 'Interviews',
		'labels'              => [
			'name'          => 'Interviews',
			'singular_name' => 'Interview',
			'add_new_item'  => 'Add New Interview',
			'edit_item'     => 'Edit Interview',
			'all_items'     => 'All Interviews',
			'menu_name'     => 'Interviews',
		],
		'public'              => true,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Interview',
		'graphql_plural_name' => 'Interviews',
		'menu_position'       => 6,
		'menu_icon'           => 'dashicons-format-quote',
		'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ],
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'interviews', 'with_front' => false ],
	] );

	register_post_type( 'feature', [
		'label'               => 'Features',
		'labels'              => [
			'name'          => 'Features',
			'singular_name' => 'Feature',
			'add_new_item'  => 'Add New Feature',
			'edit_item'     => 'Edit Feature',
			'all_items'     => 'All Features',
			'menu_name'     => 'Features',
		],
		'public'              => true,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Feature',
		'graphql_plural_name' => 'Features',
		'menu_position'       => 7,
		'menu_icon'           => 'dashicons-star-filled',
		'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ],
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'features', 'with_front' => false ],
	] );

	register_post_type( 'photographer', [
		'label'               => 'Photographers',
		'labels'              => [
			'name'          => 'Photographers',
			'singular_name' => 'Photographer',
			'add_new_item'  => 'Add New Photographer',
			'edit_item'     => 'Edit Photographer',
			'all_items'     => 'All Photographers',
			'menu_name'     => 'Photographers',
		],
		'public'              => true,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Photographer',
		'graphql_plural_name' => 'Photographers',
		'menu_position'       => 8,
		'menu_icon'           => 'dashicons-camera',
		'supports'            => [ 'title', 'editor', 'thumbnail', 'custom-fields', 'revisions' ],
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'photographers', 'with_front' => false ],
	] );

	register_post_type( 'collection', [
		'label'               => 'Collections',
		'labels'              => [
			'name'          => 'Collections',
			'singular_name' => 'Collection',
			'add_new_item'  => 'Add New Collection',
			'edit_item'     => 'Edit Collection',
			'all_items'     => 'All Collections',
			'menu_name'     => 'Collections',
		],
		'public'              => true,
		'show_in_rest'        => true,
		'show_in_graphql'     => true,
		'graphql_single_name' => 'Collection',
		'graphql_plural_name' => 'Collections',
		'menu_position'       => 9,
		'menu_icon'           => 'dashicons-portfolio',
		'supports'            => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' ],
		'has_archive'         => false,
		'rewrite'             => [ 'slug' => 'collections', 'with_front' => false ],
	] );
} );
