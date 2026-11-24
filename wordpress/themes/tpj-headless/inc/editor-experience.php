<?php
/**
 * Editor experience for the TPJ editorial team (audit 2026-11-23,
 * docs/EDITOR-UX-AUDIT.md). Nothing here removes data or existing
 * capability; unused surfaces are hidden, not deleted.
 *
 *  1. Clear image labels: Featured image → "Cover image", Hero image →
 *     "Hero image (optional)".
 *  2. Quieter admin: hide unused menus/panels (Posts, Comments,
 *     Collections, Mediums, Locations), close new comments, hide the
 *     empty bottom meta-box pane, focused dashboard.
 *  3. Photo layout block styles that output the same .fig-* classes the
 *     frontend already styles, plus a "Question" paragraph style.
 *  4. Preview: the Preview button opens the draft on the Next.js
 *     frontend through a signed, expiring link.
 *  5. Instant updates: saving a published article asks the frontend to
 *     refresh the affected pages.
 *  6. Tag suggestions: REST endpoint that runs the archive tagger
 *     (same rules as tagging/tag.mjs) on the open draft.
 *  7. Settings → TPJ for the Anthropic API key used by suggestions.
 *
 * wp-config constants (all optional; each feature turns off without its own):
 *   TPJ_FRONTEND_URL       https://v2.thephotographicjournal.com
 *   TPJ_PREVIEW_SECRET     shared with the frontend env of the same name
 *   TPJ_REVALIDATE_SECRET  shared with the frontend env of the same name
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_EDITOR_ARTICLE_TYPES = [ 'essay', 'interview', 'feature' ];
const TPJ_EDITOR_PATH          = [ 'essay' => 'essay', 'interview' => 'interview', 'feature' => 'feature' ];

// The Cover (featured) image panel only appears when the theme declares
// support; the post types already request it.
add_action( 'after_setup_theme', function () {
	add_theme_support( 'post-thumbnails' );
} );

/* ------------------------------------------------------------------ */
/* 1. Image labels                                                     */
/* ------------------------------------------------------------------ */

add_filter( 'register_post_type_args', function ( $args, $type ) {
	if ( in_array( $type, TPJ_EDITOR_ARTICLE_TYPES, true ) ) {
		$args['labels'] = array_merge( $args['labels'] ?? [], [
			'featured_image'        => 'Cover image',
			'set_featured_image'    => 'Set cover image',
			'remove_featured_image' => 'Remove cover image',
			'use_featured_image'    => 'Use as cover image',
		] );
	}
	// Collections were retired from the frontend (2026-05-04). Keep the
	// data, hide the menu.
	if ( 'collection' === $type ) {
		$args['show_ui']      = false;
		$args['show_in_menu'] = false;
	}
	return $args;
}, 10, 2 );

/* ------------------------------------------------------------------ */
/* 2. Quieter admin                                                    */
/* ------------------------------------------------------------------ */

// Mediums and Locations are unused on the frontend. Keep the taxonomies
// (and GraphQL fields) registered; hide them from menus and the editor.
add_filter( 'register_taxonomy_args', function ( $args, $taxonomy ) {
	if ( in_array( $taxonomy, [ 'tpj-medium', 'tpj-location' ], true ) ) {
		$args['show_ui']            = false;
		$args['show_in_quick_edit'] = false;
		$args['meta_box_cb']        = false;
	}
	return $args;
}, 10, 2 );

add_action( 'admin_menu', function () {
	remove_menu_page( 'edit.php' );          // Posts: TPJ publishes essays/interviews/features.
	remove_menu_page( 'edit-comments.php' ); // No comments on the frontend.
}, 999 );

add_action( 'admin_bar_menu', function ( $bar ) {
	$bar->remove_node( 'comments' );
	$bar->remove_node( 'new-post' );
}, 999 );

// Comments have nowhere to display; close them so they can't collect spam.
add_filter( 'comments_open', '__return_false', 20 );
add_filter( 'pings_open', '__return_false', 20 );

// Hide the empty bottom meta-box pane (WP 6.9 reserves half the editor for
// it whenever any classic meta box exists, even sidebar-only ones).
add_action( 'admin_head', function () {
	echo '<style>
		.edit-post-meta-boxes-main:not(:has(.edit-post-meta-boxes-area.is-normal .postbox:not(.hide-if-js)), :has(.edit-post-meta-boxes-area.is-advanced .postbox:not(.hide-if-js))) { display: none !important; }
		.tpj-term-help { margin: 2px 0 10px 28px; color: #757575; font-size: 12px; line-height: 1.4; }
	</style>';
} );

/* Dashboard: replace the defaults with what editors need. ------------- */

add_action( 'wp_dashboard_setup', function () {
	foreach ( [ 'dashboard_site_health', 'dashboard_activity', 'dashboard_right_now', 'dashboard_quick_press', 'dashboard_primary', 'dashboard_php_nag', 'dashboard_browser_nag' ] as $id ) {
		remove_meta_box( $id, 'dashboard', 'normal' );
		remove_meta_box( $id, 'dashboard', 'side' );
	}
	remove_action( 'welcome_panel', 'wp_welcome_panel' );
	wp_add_dashboard_widget( 'tpj_editorial', 'The Photographic Journal', 'tpj_render_editorial_dashboard' );
} );

function tpj_frontend_url( $post ) {
	$base = defined( 'TPJ_FRONTEND_URL' ) && TPJ_FRONTEND_URL ? untrailingslashit( TPJ_FRONTEND_URL ) : home_url();
	$seg  = TPJ_EDITOR_PATH[ $post->post_type ] ?? $post->post_type;
	return $base . '/' . $seg . '/' . $post->post_name;
}

function tpj_render_editorial_dashboard() {
	$list = function ( $posts, $link_live ) {
		if ( ! $posts ) {
			echo '<p style="color:#757575">—</p>';
			return;
		}
		echo '<ul style="margin:0">';
		foreach ( $posts as $p ) {
			$type = get_post_type_object( $p->post_type );
			printf(
				'<li style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #f0f0f1"><span><a href="%s"><strong>%s</strong></a> <span style="color:#757575">%s</span></span><span style="white-space:nowrap;color:#757575">%s%s</span></li>',
				esc_url( get_edit_post_link( $p ) ),
				esc_html( get_the_title( $p ) ?: '(no title)' ),
				esc_html( $type ? $type->labels->singular_name : '' ),
				esc_html( get_the_date( 'M j', $p ) ),
				$link_live ? ' · <a href="' . esc_url( tpj_frontend_url( $p ) ) . '" target="_blank" rel="noopener">View</a>' : ''
			);
		}
		echo '</ul>';
	};

	$base = [ 'post_type' => TPJ_EDITOR_ARTICLE_TYPES, 'posts_per_page' => 8 ];

	echo '<h3 style="margin:8px 0">Drafts</h3>';
	$list( get_posts( $base + [ 'post_status' => [ 'draft', 'pending' ], 'orderby' => 'modified' ] ), false );

	$scheduled = get_posts( $base + [ 'post_status' => 'future', 'order' => 'ASC' ] );
	if ( $scheduled ) {
		echo '<h3 style="margin:16px 0 8px">Scheduled</h3>';
		$list( $scheduled, false );
	}

	echo '<h3 style="margin:16px 0 8px">Recently published</h3>';
	$list( get_posts( $base + [ 'post_status' => 'publish', 'posts_per_page' => 6 ] ), true );

	// Needs attention: published articles missing a genre, a photographer
	// credit, or any image.
	$recent = get_posts( [ 'post_type' => TPJ_EDITOR_ARTICLE_TYPES, 'post_status' => 'publish', 'posts_per_page' => 200 ] );
	$issues = [];
	foreach ( $recent as $p ) {
		$missing = [];
		if ( ! wp_get_object_terms( $p->ID, 'tpj-genre', [ 'fields' => 'ids' ] ) ) {
			$missing[] = 'genre';
		}
		if ( function_exists( 'tpj_get_photographer_links' ) && ! tpj_get_photographer_links( $p->ID ) ) {
			$missing[] = 'photographer';
		}
		if ( ! get_post_thumbnail_id( $p ) && ! get_post_meta( $p->ID, '_tpj_hero_image_id', true ) && ! get_post_meta( $p->ID, 'header_image', true ) ) {
			$missing[] = 'cover image';
		}
		if ( $missing ) {
			$issues[] = [ $p, $missing ];
		}
		if ( count( $issues ) >= 8 ) {
			break;
		}
	}
	if ( $issues ) {
		echo '<h3 style="margin:16px 0 8px">Needs attention</h3><ul style="margin:0">';
		foreach ( $issues as [ $p, $missing ] ) {
			printf(
				'<li style="padding:6px 0;border-bottom:1px solid #f0f0f1"><a href="%s"><strong>%s</strong></a> <span style="color:#b32d2e">no %s</span></li>',
				esc_url( get_edit_post_link( $p ) ),
				esc_html( get_the_title( $p ) ),
				esc_html( implode( ', no ', $missing ) )
			);
		}
		echo '</ul>';
	}

	if ( defined( 'TPJ_FRONTEND_URL' ) && TPJ_FRONTEND_URL ) {
		printf( '<p style="margin-top:16px"><a class="button" href="%s" target="_blank" rel="noopener">Open the site</a></p>', esc_url( TPJ_FRONTEND_URL ) );
	}
}

/* ------------------------------------------------------------------ */
/* 3. Block styles                                                     */
/* ------------------------------------------------------------------ */

add_action( 'init', function () {
	foreach ( [ 'fullbleed' => 'Full bleed', 'two-thirds' => 'Two-thirds', 'margin' => 'Margin' ] as $slug => $label ) {
		register_block_style( 'core/image', [ 'name' => 'fig-' . $slug, 'label' => $label ] );
	}
	foreach ( [ 'two-up' => 'Two-up', 'three-up' => 'Three-up', 'fullbleed' => 'Full bleed' ] as $slug => $label ) {
		register_block_style( 'core/gallery', [ 'name' => 'fig-' . $slug, 'label' => $label ] );
	}
	register_block_style( 'core/paragraph', [ 'name' => 'question', 'label' => 'Question' ] );
} );

// Translate block styles into the classes the frontend already styles
// for [fig] and [int] content, so new and old posts share one design.
add_filter( 'render_block', function ( $html, $block ) {
	$name = $block['blockName'] ?? '';
	if ( ! in_array( $name, [ 'core/image', 'core/gallery', 'core/paragraph' ], true ) || '' === trim( $html ) ) {
		return $html;
	}
	$cls   = (string) ( $block['attrs']['className'] ?? '' );
	$extra = [];
	if ( 'core/paragraph' === $name ) {
		if ( preg_match( '/\bis-style-question\b/', $cls ) ) {
			$extra[] = 'int-q';
		}
	} else {
		$extra[] = 'fig';
		if ( preg_match( '/\bis-style-fig-([a-z-]+)\b/', $cls, $m ) ) {
			$extra[] = 'fig-' . $m[1];
		}
	}
	if ( ! $extra ) {
		return $html;
	}
	$tag = 'core/paragraph' === $name ? 'p' : 'figure';
	return preg_replace_callback(
		'/<' . $tag . '\b([^>]*)>/',
		function ( $m ) use ( $extra, $tag ) {
			$open = $m[0];
			if ( false !== strpos( $open, 'class="' ) ) {
				return preg_replace( '/class="/', 'class="' . implode( ' ', $extra ) . ' ', $open, 1 );
			}
			return '<' . $tag . $m[1] . ' class="' . implode( ' ', $extra ) . '">';
		},
		$html,
		1
	);
}, 10, 2 );

// Editor preview of the layouts, so the canvas resembles the site.
add_action( 'enqueue_block_editor_assets', function () {
	$rel = 'assets/editor-styles.css';
	wp_enqueue_style( 'tpj-editor-styles', get_stylesheet_directory_uri() . '/' . $rel, [], filemtime( get_stylesheet_directory() . '/' . $rel ) );
} );

/* ------------------------------------------------------------------ */
/* 4. Preview on the frontend                                          */
/* ------------------------------------------------------------------ */

function tpj_preview_url( $post ) {
	if ( ! defined( 'TPJ_FRONTEND_URL' ) || ! TPJ_FRONTEND_URL || ! defined( 'TPJ_PREVIEW_SECRET' ) || ! TPJ_PREVIEW_SECRET ) {
		return null;
	}
	if ( ! in_array( $post->post_type, TPJ_EDITOR_ARTICLE_TYPES, true ) ) {
		return null;
	}
	$exp    = time() + HOUR_IN_SECONDS;
	$status = 'publish' === $post->post_status ? 'publish' : 'draft';
	$sig    = hash_hmac( 'sha256', "{$post->post_type}|{$post->ID}|{$status}|{$exp}", TPJ_PREVIEW_SECRET );
	return add_query_arg(
		[ 'type' => $post->post_type, 'id' => $post->ID, 'status' => $status, 'exp' => $exp, 'sig' => $sig ],
		untrailingslashit( TPJ_FRONTEND_URL ) . '/api/preview'
	);
}

// The frontend reads drafts over GraphQL with an application password
// (a dedicated preview user). WordPress only honours application
// passwords on REST/XML-RPC by default; allow them on /graphql too.
add_filter( 'application_password_is_api_request', function ( $is_api ) {
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
	return $is_api || (bool) preg_match( '#^/graphql/?(\?|$)#', $uri );
} );

add_filter( 'preview_post_link', function ( $link, $post ) {
	return tpj_preview_url( $post ) ?: $link;
}, 10, 2 );

// "View" links: point straight at the frontend path (the frontend also
// redirects the old plural paths).
add_filter( 'post_type_link', function ( $link, $post ) {
	if ( is_admin() && 'publish' === $post->post_status && isset( TPJ_EDITOR_PATH[ $post->post_type ] ) && defined( 'TPJ_FRONTEND_URL' ) && TPJ_FRONTEND_URL ) {
		return tpj_frontend_url( $post );
	}
	return $link;
}, 20, 2 );

/* ------------------------------------------------------------------ */
/* 5. Instant updates on the frontend                                  */
/* ------------------------------------------------------------------ */

function tpj_request_revalidate( array $paths ) {
	if ( ! defined( 'TPJ_FRONTEND_URL' ) || ! TPJ_FRONTEND_URL || ! defined( 'TPJ_REVALIDATE_SECRET' ) || ! TPJ_REVALIDATE_SECRET ) {
		return;
	}
	wp_remote_post( untrailingslashit( TPJ_FRONTEND_URL ) . '/api/revalidate', [
		'blocking' => false,
		'timeout'  => 3,
		'headers'  => [ 'Content-Type' => 'application/json', 'x-tpj-secret' => TPJ_REVALIDATE_SECRET ],
		'body'     => wp_json_encode( [ 'paths' => array_values( array_unique( $paths ) ) ] ),
	] );
}

add_action( 'transition_post_status', function ( $new, $old, $post ) {
	if ( 'publish' !== $new && 'publish' !== $old ) {
		return;
	}
	if ( isset( TPJ_EDITOR_PATH[ $post->post_type ] ) ) {
		tpj_request_revalidate( [ '/', '/explore', '/themes', '/' . TPJ_EDITOR_PATH[ $post->post_type ] . '/' . $post->post_name ] );
	} elseif ( 'photographer' === $post->post_type ) {
		tpj_request_revalidate( [ '/photographers', '/photographer/' . $post->post_name ] );
	}
}, 10, 3 );

// Meta and term changes made after the status transition (block editor
// saves meta in a second request) — refresh again on the final save.
add_action( 'wp_after_insert_post', function ( $post_id, $post ) {
	if ( 'publish' === $post->post_status && isset( TPJ_EDITOR_PATH[ $post->post_type ] ) && ! wp_is_post_revision( $post_id ) ) {
		tpj_request_revalidate( [ '/', '/' . TPJ_EDITOR_PATH[ $post->post_type ] . '/' . $post->post_name ] );
	}
}, 10, 2 );

/* ------------------------------------------------------------------ */
/* 6. Tag suggestions                                                  */
/* ------------------------------------------------------------------ */

function tpj_genre_definitions() {
	return [
		'documentary'  => 'Real people, places and events recorded as they are, usually with a social, political or reportage purpose (photojournalism, long-form documentary, conflict, community stories).',
		'street'       => 'Candid, unstaged moments in public space, found rather than arranged; the city or the street as stage. Includes night street work.',
		'portraiture'  => 'The person is the subject. Posed or collaborative portraits, environmental portraits, self-portraiture.',
		'fashion'      => 'Clothing, styling, models and editorial or commercial fashion image-making, including fashion-adjacent beauty work.',
		'fine-art'     => 'Conceptual or artist-led projects made for the gallery or book, where the idea or aesthetic leads rather than the record.',
		'landscape'    => 'Land, terrain, built environment or nature as the primary subject; people absent or incidental.',
		'still-life'   => 'Arranged or found objects, food, flowers, products or interiors as the subject.',
		'experimental' => 'Process- or medium-driven work: alternative processes, collage, manipulation, abstraction, camera-less or AI-adjacent experiments.',
	];
}

add_action( 'rest_api_init', function () {
	register_rest_route( 'tpj/v1', '/suggest-tags', [
		'methods'             => 'POST',
		'permission_callback' => function () {
			return current_user_can( 'edit_posts' );
		},
		'callback'            => 'tpj_rest_suggest_tags',
	] );
} );

function tpj_rest_suggest_tags( WP_REST_Request $req ) {
	$key = get_option( 'tpj_anthropic_api_key' );
	if ( ! $key ) {
		return new WP_Error( 'tpj_no_key', 'Tag suggestions need an Anthropic API key (Settings → TPJ).', [ 'status' => 400 ] );
	}

	$title   = sanitize_text_field( (string) $req->get_param( 'title' ) );
	$intro   = sanitize_textarea_field( (string) $req->get_param( 'intro' ) );
	$content = (string) $req->get_param( 'content' );
	$type    = sanitize_key( (string) $req->get_param( 'type' ) );
	$images  = array_slice( array_filter( array_map( 'esc_url_raw', (array) $req->get_param( 'images' ) ) ), 0, 5 );

	$text = preg_replace( '/\[fig[^\]]*caption="([^"]*)"[^\]]*\]/i', "\n(Caption: $1)\n", $content );
	$text = preg_replace( '/\[\/?[a-z_]+[^\]]*\]/i', ' ', $text );
	$text = trim( html_entity_decode( wp_strip_all_tags( $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
	$text = mb_substr( preg_replace( "/\s+/", ' ', $text ), 0, 30000 );

	$genres = tpj_genre_definitions();
	$themes = [];
	foreach ( tpj_get_theme_definitions() as $t ) {
		$themes[ $t['slug'] ] = $t['prompt'];
	}
	$list = function ( $defs ) {
		return implode( "\n", array_map( fn( $k, $v ) => "- $k: $v", array_keys( $defs ), $defs ) );
	};

	$system = "You tag articles for The Photographic Journal (TPJ), an independent editorial photography publication.\n\n"
		. "GENRES - what kind of photography this is. Decide mainly from the photographs.\n" . $list( $genres ) . "\n"
		. "Every article gets 1 or 2 genres, dominant first. For interviews and features, tag the featured photographer's work. Prefer the narrower genre when it fits.\n\n"
		. "THEMES - what the work is about. Each theme is an editorial collection, written as the question it asks:\n" . $list( $themes ) . "\n"
		. "Assign 0 to 3 themes, only when the work is genuinely about that question, visibly and in the text. Incidental presence does not count. When in doubt include the theme with an honest low score.\n\n"
		. "For every tag give an integer score 0-100 (90+ unmistakable, 75-89 clearly right, 60-74 defensible, below 60 weak) and one short concrete evidence sentence.";

	$item  = [ 'type' => 'object', 'properties' => [ 'slug' => [ 'type' => 'string' ], 'score' => [ 'type' => 'integer' ], 'evidence' => [ 'type' => 'string' ] ], 'required' => [ 'slug', 'score', 'evidence' ], 'additionalProperties' => false ];
	$gItem = $item; $gItem['properties']['slug']['enum'] = array_keys( $genres );
	$tItem = $item; $tItem['properties']['slug']['enum'] = array_keys( $themes );

	$blocks = [];
	foreach ( $images as $url ) {
		$blocks[] = [ 'type' => 'image', 'source' => [ 'type' => 'url', 'url' => $url ] ];
	}
	$blocks[] = [ 'type' => 'text', 'text' => "Type: $type\nTitle: $title\n\nIntro:\n" . ( $intro ?: '(none)' ) . "\n\nFull text:\n" . ( $text ?: '(no text; judge from the photographs)' ) . "\n\nAbove are " . count( $images ) . ' photographs from this article. Tag it.' ];

	$res = wp_remote_post( 'https://api.anthropic.com/v1/messages', [
		'timeout' => 90,
		'headers' => [ 'x-api-key' => $key, 'anthropic-version' => '2023-06-01', 'content-type' => 'application/json' ],
		'body'    => wp_json_encode( [
			'model'         => 'claude-opus-5-5',
			'max_tokens'    => 4000,
			'system'        => $system,
			'messages'      => [ [ 'role' => 'user', 'content' => $blocks ] ],
			'output_config' => [ 'format' => [ 'type' => 'json_schema', 'schema' => [
				'type' => 'object',
				'properties' => [ 'genres' => [ 'type' => 'array', 'items' => $gItem ], 'themes' => [ 'type' => 'array', 'items' => $tItem ] ],
				'required' => [ 'genres', 'themes' ],
				'additionalProperties' => false,
			] ] ],
		] ),
	] );
	if ( is_wp_error( $res ) ) {
		return new WP_Error( 'tpj_api', $res->get_error_message(), [ 'status' => 502 ] );
	}
	$body = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( 200 !== wp_remote_retrieve_response_code( $res ) ) {
		return new WP_Error( 'tpj_api', $body['error']['message'] ?? 'Suggestion request failed.', [ 'status' => 502 ] );
	}
	$json = null;
	foreach ( (array) ( $body['content'] ?? [] ) as $c ) {
		if ( 'text' === ( $c['type'] ?? '' ) ) {
			$json = json_decode( $c['text'], true );
		}
	}
	if ( ! is_array( $json ) ) {
		return new WP_Error( 'tpj_api', 'Could not read the suggestion.', [ 'status' => 502 ] );
	}

	// Same rules as the archive pass: top genre + a second at 60+; themes at 70+, max 3.
	$sort = function ( $a ) {
		$seen = [];
		foreach ( (array) $a as $t ) {
			if ( ! isset( $seen[ $t['slug'] ] ) || $seen[ $t['slug'] ]['score'] < $t['score'] ) $seen[ $t['slug'] ] = $t;
		}
		usort( $seen, fn( $x, $y ) => $y['score'] <=> $x['score'] );
		return array_values( $seen );
	};
	$g = $sort( $json['genres'] );
	$t = $sort( $json['themes'] );
	foreach ( $g as $i => &$x ) $x['recommended'] = 0 === $i || ( 1 === $i && $x['score'] >= 60 );
	unset( $x );
	$n = 0;
	foreach ( $t as &$x ) { $x['recommended'] = $x['score'] >= 70 && $n < 3; if ( $x['recommended'] ) $n++; }
	unset( $x );

	$ids = function ( $tax, $slug ) {
		$term = get_term_by( 'slug', $slug, $tax );
		return $term ? (int) $term->term_id : 0;
	};
	foreach ( $g as &$x ) $x['term_id'] = $ids( 'tpj-genre', $x['slug'] );
	unset( $x );
	foreach ( $t as &$x ) $x['term_id'] = $ids( 'tpj-theme', $x['slug'] );
	unset( $x );

	return [ 'genres' => $g, 'themes' => $t ];
}

/* ------------------------------------------------------------------ */
/* 7. Settings → TPJ                                                   */
/* ------------------------------------------------------------------ */

add_action( 'admin_menu', function () {
	add_options_page( 'TPJ', 'TPJ', 'manage_options', 'tpj-settings', function () {
		if ( isset( $_POST['tpj_settings_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['tpj_settings_nonce'] ) ), 'tpj_settings' ) ) {
			$new = trim( sanitize_text_field( wp_unslash( $_POST['tpj_anthropic_api_key'] ?? '' ) ) );
			if ( '' !== $new ) {
				update_option( 'tpj_anthropic_api_key', $new, false );
			}
			if ( ! empty( $_POST['tpj_clear_key'] ) ) {
				delete_option( 'tpj_anthropic_api_key' );
			}
			echo '<div class="notice notice-success"><p>Saved.</p></div>';
		}
		$has = (bool) get_option( 'tpj_anthropic_api_key' );
		?>
		<div class="wrap">
			<h1>TPJ</h1>
			<form method="post">
				<?php wp_nonce_field( 'tpj_settings', 'tpj_settings_nonce' ); ?>
				<table class="form-table"><tr>
					<th scope="row"><label for="tpj_anthropic_api_key">Anthropic API key</label></th>
					<td>
						<input type="password" id="tpj_anthropic_api_key" name="tpj_anthropic_api_key" class="regular-text" autocomplete="off" placeholder="<?php echo $has ? '•••••••• (saved)' : 'sk-ant-…'; ?>">
						<p class="description">Used by “Suggest tags” in the editor.</p>
						<?php if ( $has ) : ?><label><input type="checkbox" name="tpj_clear_key" value="1"> Remove saved key</label><?php endif; ?>
					</td>
				</tr></table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	} );
} );

/* ------------------------------------------------------------------ */
/* Editor script                                                       */
/* ------------------------------------------------------------------ */

add_action( 'enqueue_block_editor_assets', function () {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || ! in_array( $screen->post_type, TPJ_EDITOR_ARTICLE_TYPES, true ) ) {
		return;
	}
	$rel = 'assets/editor-experience.js';
	wp_enqueue_script(
		'tpj-editor-experience',
		get_stylesheet_directory_uri() . '/' . $rel,
		[ 'wp-plugins', 'wp-edit-post', 'wp-editor', 'wp-element', 'wp-components', 'wp-data', 'wp-hooks', 'wp-api-fetch', 'wp-core-data' ],
		filemtime( get_stylesheet_directory() . '/' . $rel ),
		true
	);
	$themes = [];
	foreach ( tpj_get_theme_definitions() as $t ) {
		$themes[ $t['slug'] ] = $t['prompt'];
	}
	wp_localize_script( 'tpj-editor-experience', 'tpjEditor', [
		'themes'  => $themes,
		'genres'  => tpj_genre_definitions(),
		'hasKey'  => (bool) get_option( 'tpj_anthropic_api_key' ),
		'isAdmin' => current_user_can( 'manage_options' ),
	] );
} );
