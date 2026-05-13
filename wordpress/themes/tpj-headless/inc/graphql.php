<?php
/**
 * TPJ V2 GraphQL extensions.
 *
 * Exposes photographer post meta (website, social handles, interview count)
 * on the Photographer GraphQL type so the frontend can render profiles
 * without separate REST round-trips.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Raise the per-query connection limit so the Explore page can return
 * the entire archive in a single request. Default is 100; the archive
 * has ~616 essays, 98 interviews, and 21 features.
 */
add_filter( 'graphql_connection_max_query_amount', function () {
	return 1000;
} );

/**
 * Heuristic: does this string plausibly represent a person's name, vs.
 * a topic / theme tag like "Abstract" or "Black and White"? Used to
 * filter the first-tag fallback in photographer name resolution so we
 * don't create Photographer CPT records named after subjects.
 *
 * Rules: at least one space, no digits, reasonable length, must avoid a
 * small list of obvious non-name substrings ("photography", "still
 * life", etc.). Each whitespace-separated word must start with an
 * uppercase letter, except common European particles (de, van, von, da,
 * di, la, le, der, den, du).
 */
function tpj_looks_like_personal_name( $candidate ) {
	$s = trim( (string) $candidate );
	if ( $s === '' || mb_strlen( $s ) > 80 ) return false;
	if ( preg_match( '/\d/', $s ) ) return false;
	if ( ! preg_match( '/\s/', $s ) ) return false;

	$lower = strtolower( $s );
	$reject = [
		'photography', 'photographer', 'photo essay', 'photo essays',
		'still life', 'fine art', 'black and white', 'black & white',
	];
	foreach ( $reject as $sub ) {
		if ( strpos( $lower, $sub ) !== false ) return false;
	}

	$particles = [ 'de', 'van', 'von', 'da', 'di', 'la', 'le', 'der', 'den', 'du' ];
	$words = preg_split( '/\s+/', $s );
	$seen_upper = false;
	foreach ( $words as $word ) {
		if ( $word === '' ) continue;
		if ( in_array( strtolower( $word ), $particles, true ) ) continue;
		$first = mb_substr( $word, 0, 1 );
		if ( $first !== mb_strtoupper( $first ) ) return false;
		$seen_upper = true;
	}
	return $seen_upper;
}

/**
 * Sanitize the `photographer` ACF meta value into a bare photographer
 * name, or null if the value clearly isn't one.
 *
 *  - Strips editorial prefixes: "Photos by", "Photography by", etc.
 *  - Strips trailing punctuation (commas, semicolons).
 *  - Returns null when the value names a non-photographer role
 *    ("Model:", "In Collaboration with", "Words by") so we don't
 *    mistakenly attribute the photo essay to the subject of the photos.
 */
function tpj_sanitize_photographer_meta_value( $raw ) {
	if ( ! is_string( $raw ) ) return null;
	$s = trim( $raw );
	if ( $s === '' ) return null;

	// Markers that indicate the meta value is *not* the photographer.
	// Book-review credits and other non-photo roles get rejected; the
	// article appears as unattributed rather than crediting the wrong
	// person.
	$reject_patterns = [
		'/^model\s*[:\-]/i',
		'/^subject\s*[:\-]/i',
		'/^featuring\s*[:\-]?\s+/i',
		'/^starring\s*[:\-]?\s+/i',
		'/^in\s+collaboration\s+with\s+/i',
		'/^written\s+by\s+/i',
		'/^words\s+by\s+/i',
		'/^essay\s+by\s+/i',
		'/^interviewed\s+by\s+/i',
		'/^interview\s+by\s+/i',
		'/^as\s+told\s+to\s+/i',
		'/^edited\s+by\s+/i',
		'/^styling\s+by\s+/i',
		'/^styled\s+by\s+/i',
		'/^reviewed?\s+by\s+/i',
		'/^review\s*[:\-]/i',
		'/^book\s+review\s*[:\-]?/i',
	];
	foreach ( $reject_patterns as $p ) {
		if ( preg_match( $p, $s ) ) return null;
	}

	// Patterns where the photographer name appears AFTER a credit
	// marker mid-string. "Mary Jones portraits by John Smith" → use
	// "John Smith". The marker list is intentionally narrow; we only
	// extract when the suffix looks unambiguously like a credit.
	if ( preg_match(
		'/\b(?:photographed|photographs?|photography|photos?|images?|pictures?|portraits?|shot)\s+by\s+(.+?)$/iu',
		$s,
		$m
	) ) {
		$s = trim( $m[1] );
	}

	// Editorial credit prefixes that should be stripped, leaving the
	// name. "Self portrait courtesy of X" / "courtesy of X" both reduce
	// to X — self-portraits are credited to the subject, who took the
	// picture themselves.
	$strip_patterns = [
		'/^self\s*-?\s*portraits?\s*[,;:]?\s*(?:of\s+)?courtesy\s+(?:of\s+)?/i',
		'/^courtesy\s+(?:of\s+)?/i',
		'/^photos?\s+by\s+/i',
		'/^photographed\s+by\s+/i',
		'/^photography\s+by\s+/i',
		'/^photographs?\s+by\s+/i',
		'/^images?\s+by\s+/i',
		'/^pictures?\s+by\s+/i',
	];
	foreach ( $strip_patterns as $p ) {
		$s = preg_replace( $p, '', $s );
	}

	// Trim trailing punctuation and stray whitespace.
	$s = preg_replace( '/[,;.\s]+$/u', '', $s );
	$s = trim( $s );

	return $s === '' ? null : $s;
}

/**
 * Resolve photographer names for an article. Prefer the `photographer`
 * post meta (set explicitly by editors), sanitized via
 * tpj_sanitize_photographer_meta_value, then split on
 * collaboration markers (&, "and", comma) so multi-author credits
 * become an ordered list. Falls back to the first tag that looks like
 * a personal name; topic tags ("Abstract") are rejected so we don't
 * pin them onto everyone tagged with them.
 *
 * Returns an empty array when no name is resolvable. The caller decides
 * whether to leave the article unattributed or unlink an existing
 * non-personal-name CPT.
 */
function tpj_resolve_photographer_names( $post_id ) {
	$cleaned = tpj_sanitize_photographer_meta_value(
		get_post_meta( $post_id, 'photographer', true )
	);
	if ( $cleaned !== null ) {
		$names = tpj_split_photographer_names( $cleaned );
		if ( ! empty( $names ) ) {
			return $names;
		}
	}
	$tags = wp_get_post_tags( $post_id );
	if ( ! empty( $tags ) ) {
		foreach ( $tags as $tag ) {
			$tag_name = trim( (string) $tag->name );
			if ( $tag_name !== '' && tpj_looks_like_personal_name( $tag_name ) ) {
				return [ $tag_name ];
			}
		}
	}
	return [];
}

/**
 * Single-name resolver kept for callers that need exactly one name —
 * relink/audit/dupe-finder logic that operates on one CPT at a time.
 * Returns the FIRST resolved name (or null), never a joined string,
 * so multi-author articles still produce a single primary lookup.
 * For display purposes that should reflect the full collaboration,
 * use tpj_resolve_photographer_names() and join in the caller.
 */
function tpj_resolve_photographer_name( $post_id ) {
	$names = tpj_resolve_photographer_names( $post_id );
	return empty( $names ) ? null : $names[0];
}

add_action( 'graphql_register_types', function () {
	if ( ! function_exists( 'register_graphql_field' ) ) {
		return;
	}

	$string_meta = [
		'website'   => 'website',
		'instagram' => 'instagram',
		'twitter'   => 'twitter',
		'facebook'  => 'facebook',
		'tumblr'    => 'tumblr',
		'flickr'    => 'flickr',
		'vsco_grid' => 'vsco_grid',
		'vimeo'     => 'vimeo',
		'blog'      => 'blog',
		'bluesky'   => 'bluesky',
		'threads'   => 'threads',
		'linkedin'  => 'linkedin',
		'location'       => 'tpj_location',
		'email'          => 'tpj_email',
		'represented_by' => 'tpj_represented_by',
	];

	foreach ( $string_meta as $field_name => $meta_key ) {
		register_graphql_field( 'Photographer', $field_name, [
			'type'        => 'String',
			'description' => 'Optional ' . $field_name . ' link.',
			'resolve'     => function ( $post ) use ( $meta_key ) {
				$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
				$value = get_post_meta( $id, $meta_key, true );
				return is_string( $value ) && $value !== '' ? $value : null;
			},
		] );
	}

	register_graphql_field( 'Photographer', 'atomicCombo', [
		'type'        => 'Boolean',
		'description' => 'When true, the title is a single duo / collective credit (e.g. "Anais & Dax") and should not be split on "&".',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			return (bool) get_post_meta( $id, 'tpj_atomic_combo', true );
		},
	] );

	register_graphql_field( 'Photographer', 'interviewCount', [
		'type'        => 'Int',
		'description' => 'Number of TPJ interviews this photographer appears in.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			$value = get_post_meta( $id, 'tpj_interview_count', true );
			return is_numeric( $value ) ? (int) $value : 0;
		},
	] );

	register_graphql_field( 'Photographer', 'tpjPortraitUrl', [
		'type'        => 'String',
		'description' => 'Portrait image URL captured from the v1 .circletar custom_css.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			$value = get_post_meta( $id, 'tpj_portrait_url', true );
			return is_string( $value ) && $value !== '' ? $value : null;
		},
	] );

	register_graphql_field( 'Photographer', 'linkedArticleCount', [
		'type'        => 'Int',
		'description' => 'Number of essays/interviews/features linked to this photographer via tpj_photographer meta.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			if ( ! $id ) return 0;
			$q = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $id,
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'no_found_rows'  => false,
			] );
			return (int) $q->found_posts;
		},
	] );

	// Featured image of the most recent article linked to this photographer.
	// Used as a portrait fallback on cards/profile when the photographer
	// record itself has no portrait set.
	register_graphql_field( 'Photographer', 'fallbackEssayThumbnail', [
		'type'        => 'String',
		'description' => 'Featured image URL of the most recent essay/interview/feature linked to this photographer; intended as a portrait fallback.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			if ( ! $id ) return null;
			$q = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $id,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'no_found_rows'  => true,
			] );
			if ( empty( $q->posts ) ) return null;
			$thumb = get_the_post_thumbnail_url( $q->posts[0], 'large' );
			return $thumb ?: null;
		},
	] );

	register_graphql_field( 'Collection', 'targetCount', [
		'type'        => 'Int',
		'description' => 'Editor-set target number of articles in the collection.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			$value = get_post_meta( $id, 'tpj_target_count', true );
			return is_numeric( $value ) ? (int) $value : 0;
		},
	] );

	register_graphql_field( 'Collection', 'curatorsNoteHeading', [
		'type'        => 'String',
		'description' => 'Heading for the curators note on the detail page.',
		'resolve'     => function ( $post ) {
			$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
			$value = get_post_meta( $id, 'tpj_curators_note_heading', true );
			return is_string( $value ) && $value !== '' ? $value : null;
		},
	] );

	// Editorial intro (v1 ACF "intro" textarea on essays/interviews/features).
	$intro_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		$value = get_post_meta( $id, 'intro', true );
		return is_string( $value ) && $value !== '' ? $value : null;
	};

	// Photographer display name. For multi-author articles this is the
	// joined credit string ("Annika White & Carl Knight"); single-author
	// articles get the lone name. Listings that don't render multiple
	// photographer cards can keep using this field.
	$photographer_name_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		$names = tpj_resolve_photographer_names( $id );
		return empty( $names ) ? null : tpj_join_photographer_names( $names );
	};

	// Photographer credit names as an ordered list. Empty array when no
	// name resolves (vs. null on photographerName) so the frontend can
	// distinguish "unattributed" from "single credit" without re-parsing.
	$photographer_names_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		return tpj_resolve_photographer_names( $id );
	};

	// Primary linked Photographer CPT (first stored link). Kept as the
	// singular field for callers that pre-date multi-author and only
	// render one card; new code should use linkedPhotographers (plural).
	$linked_photographer_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		$linked_id = tpj_get_primary_photographer_id( $id );
		if ( ! $linked_id ) return null;
		$photog_post = get_post( $linked_id );
		if ( ! $photog_post || $photog_post->post_type !== 'photographer' ) return null;
		if ( $photog_post->post_status !== 'publish' ) return null;
		return new \WPGraphQL\Model\Post( $photog_post );
	};

	// Every linked Photographer CPT for the article, in stored order.
	// Lets the frontend render one card per photographer on
	// collaboration credits.
	$linked_photographers_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		$ids = tpj_get_photographer_links( $id );
		$out = [];
		foreach ( $ids as $linked_id ) {
			$photog_post = get_post( $linked_id );
			if ( ! $photog_post || $photog_post->post_type !== 'photographer' ) continue;
			if ( $photog_post->post_status !== 'publish' ) continue;
			$out[] = new \WPGraphQL\Model\Post( $photog_post );
		}
		return $out;
	};

	$author_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		if ( $id === 0 ) return null;
		// Read the unified key first; fall back to the legacy
		// Feature-only key so existing data renders correctly until
		// `wp tpj migrate-byline-author` runs.
		$value = get_post_meta( $id, 'tpj_byline_author', true );
		if ( ! is_string( $value ) || trim( $value ) === '' ) {
			$value = get_post_meta( $id, 'tpj_feature_writer', true );
		}
		$trimmed = is_string( $value ) ? trim( $value ) : '';
		return $trimmed !== '' ? $trimmed : null;
	};

	$hero_image_resolver = function ( $post ) {
		$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
		if ( $id === 0 ) return null;
		// Fallback chain: new override → v1 ACF header_image → WP
		// featured (_thumbnail_id). Returns an attachment Post model
		// so consumers get the same shape as featuredImage.node.
		$attachment_id = (int) get_post_meta( $id, '_tpj_hero_image_id', true );
		if ( ! $attachment_id ) {
			$attachment_id = (int) get_post_meta( $id, 'header_image', true );
		}
		if ( ! $attachment_id ) {
			$attachment_id = (int) get_post_thumbnail_id( $id );
		}
		if ( ! $attachment_id ) return null;
		$attachment = get_post( $attachment_id );
		if ( ! $attachment || $attachment->post_type !== 'attachment' ) {
			return null;
		}
		return new \WPGraphQL\Model\Post( $attachment );
	};

	foreach ( [ 'Essay', 'Interview', 'Feature' ] as $type ) {
		register_graphql_field( $type, 'articleIntro', [
			'type'        => 'String',
			'description' => 'Editorial intro / lede stored as the v1 ACF intro field.',
			'resolve'     => $intro_resolver,
		] );
		register_graphql_field( $type, 'articleAuthor', [
			'type'        => 'String',
			'description' => 'Byline credit for the prose author. Interviewer on Interview, Writer on Feature. Empty on Essay (photo-led). Reads `tpj_byline_author` with `tpj_feature_writer` legacy fallback.',
			'resolve'     => $author_resolver,
		] );
		register_graphql_field( $type, 'heroImage', [
			'type'        => 'MediaItem',
			'description' => 'Image shown at the top of the article. Falls back through `_tpj_hero_image_id` → v1 `header_image` → `_thumbnail_id` (WP featured). Use this on detail pages instead of `featuredImage` so v1 archive renders the correct hero crop.',
			'resolve'     => $hero_image_resolver,
		] );
		register_graphql_field( $type, 'staffPick', [
			'type'        => 'Boolean',
			'description' => 'Editorial flag set by the team to highlight a piece on the homepage hero carousel and weight it in Dive Deeper selection.',
			'resolve'     => function ( $post ) {
				$id = is_object( $post ) ? ( $post->ID ?? 0 ) : 0;
				if ( $id === 0 ) return false;
				return (bool) get_post_meta( $id, 'tpj_staff_pick', true );
			},
		] );
		register_graphql_field( $type, 'photographerName', [
			'type'        => 'String',
			'description' => 'Display name credit. Joined ("X & Y") for multi-author articles; single name otherwise. Use photographerNames for an ordered list.',
			'resolve'     => $photographer_name_resolver,
		] );
		register_graphql_field( $type, 'photographerNames', [
			'type'        => [ 'list_of' => 'String' ],
			'description' => 'Photographer credit names in collaboration order. Empty array when no name resolves.',
			'resolve'     => $photographer_names_resolver,
		] );
		register_graphql_field( $type, 'linkedPhotographer', [
			'type'        => 'Photographer',
			'description' => 'Primary (first) linked Photographer CPT. For collaborations, prefer linkedPhotographers (plural).',
			'resolve'     => $linked_photographer_resolver,
		] );
		register_graphql_field( $type, 'linkedPhotographers', [
			'type'        => [ 'list_of' => 'Photographer' ],
			'description' => 'Every linked Photographer CPT for this article, in stored order. One per credited photographer.',
			'resolve'     => $linked_photographers_resolver,
		] );
	}

	// Deprecated alias for `articleAuthor`. Kept so existing
	// Feature queries don't break. Reads the same unified key with
	// the same legacy fallback as articleAuthor.
	register_graphql_field( 'Feature', 'tpjFeatureWriter', [
		'type'        => 'String',
		'description' => 'Deprecated. Use `articleAuthor` instead. Same value, unified across Interview + Feature.',
		'resolve'     => $author_resolver,
	] );

	// Essays filtered by a tpj-theme slug. WPGraphQL 2.x dropped the
	// auto-generated `themesIn` where-arg on the essays connection
	// and the introspectable replacement (`taxQuery`) isn't exposed
	// in this build either. This custom root field plugs the gap so
	// the homepage ThemeBrowser and /theme/<slug> page can request
	// AI-tagged essays without a server-side schema upgrade.
	register_graphql_field( 'RootQuery', 'essaysByThemeSlug', [
		'type'        => [ 'list_of' => 'Essay' ],
		'description' => 'Essays tagged with the given tpj-theme slug, newest first. Returns an empty list when nothing is tagged yet for that slug — pairs with the homepage random-sample fallback during the tagger rollout.',
		'args' => [
			'themeSlug' => [
				'type'        => [ 'non_null' => 'String' ],
				'description' => 'tpj-theme term slug, e.g. "identity".',
			],
			'first' => [
				'type'        => 'Int',
				'description' => 'Maximum number of essays to return. Defaults to 12.',
			],
		],
		'resolve' => function ( $root, $args ) {
			$slug  = isset( $args['themeSlug'] ) ? sanitize_title( (string) $args['themeSlug'] ) : '';
			$first = isset( $args['first'] ) ? max( 1, min( 100, (int) $args['first'] ) ) : 12;
			if ( $slug === '' ) {
				return [];
			}
			$posts = get_posts( [
				'post_type'      => 'essay',
				'post_status'    => 'publish',
				'posts_per_page' => $first,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'tax_query'      => [ [
					'taxonomy' => 'tpj-theme',
					'field'    => 'slug',
					'terms'    => [ $slug ],
					'operator' => 'IN',
				] ],
			] );
			// Wrap raw WP_Post in WPGraphQL's Post model so field
			// resolvers (id, title, slug, etc.) can extract values
			// the same way they do for the auto-generated connections.
			return array_map( fn( $post ) => new \WPGraphQL\Model\Post( $post ), $posts );
		},
	] );

	// Staff-picked articles across essay/interview/feature, in
	// random order per ISR cache. Powers the homepage hero
	// carousel's "Staff Pick" slide and Dive Deeper's weighted
	// featured-essay slots. The `ContentNode` return type is
	// WPGraphQL's polymorphic interface implemented by every CPT,
	// so the frontend uses inline fragments to read post-type-
	// specific fields.
	register_graphql_field( 'RootQuery', 'staffPicks', [
		'type'        => [ 'list_of' => 'ContentNode' ],
		'description' => 'Articles flagged as staff picks (`tpj_staff_pick` meta), random order. Returns an empty list when nothing is flagged.',
		'args'        => [
			'first' => [
				'type'        => 'Int',
				'description' => 'Maximum number to return. Defaults to 6.',
			],
		],
		'resolve'     => function ( $root, $args ) {
			$first = isset( $args['first'] ) ? max( 1, min( 50, (int) $args['first'] ) ) : 6;
			$ids = get_posts( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'posts_per_page' => $first,
				'orderby'        => 'rand',
				'fields'         => 'ids',
				'meta_query'     => [ [
					'key'     => 'tpj_staff_pick',
					'value'   => '1',
					'compare' => '=',
				] ],
			] );
			$out = [];
			foreach ( $ids as $id ) {
				$post = get_post( $id );
				if ( $post ) {
					$out[] = new \WPGraphQL\Model\Post( $post );
				}
			}
			return $out;
		},
	] );
} );
