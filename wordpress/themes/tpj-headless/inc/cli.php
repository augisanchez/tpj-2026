<?php
/**
 * TPJ V2 WP-CLI commands for one-time data migrations.
 *
 *   wp tpj migrate-photographers
 *   wp tpj seed-collections
 *
 * Both commands are idempotent: running twice produces the same end state.
 * They look up by slug, update if found, create if missing.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WP_CLI' ) ) {
	return;
}

class TPJ_CLI {

	/**
	 * Pull photographer data out of interview post meta and create
	 * Photographer CPT records.
	 *
	 * Source fields per interview (sparse, optional):
	 *   photographer   text — the photographer's name
	 *   webstie        url  — typo'd field; maps to `website`
	 *   instagram, twitter, facebook, tumblr, flickr, vsco_grid, vimeo, blog
	 *   about          html — used as bio when present
	 *
	 * The interview's featured image is used as the photographer's portrait
	 * fallback. Real portraits get added later in editor review.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Print what would change without writing.
	 *
	 * @when after_wp_load
	 */
	public function migrate_photographers( $args, $assoc_args ) {
		$dry_run = isset( $assoc_args['dry-run'] );

		WP_CLI::log( 'Reading interviews…' );

		$interviews = get_posts( [
			'post_type'      => 'interview',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'date',
			'order'          => 'DESC',
		] );

		WP_CLI::log( sprintf( 'Found %d published interviews.', count( $interviews ) ) );

		$photographers = [];

		foreach ( $interviews as $interview ) {
			$name = trim( (string) get_post_meta( $interview->ID, 'photographer', true ) );
			if ( $name === '' ) {
				continue;
			}

			$key = strtolower( $name );
			if ( ! isset( $photographers[ $key ] ) ) {
				$photographers[ $key ] = [
					'name'       => $name,
					'bios'       => [],
					'website'    => '',
					'socials'    => [],
					'portrait'   => 0,
					'interview_ids' => [],
				];
			}

			$bucket = &$photographers[ $key ];
			$bucket['interview_ids'][] = $interview->ID;

			$about = get_post_meta( $interview->ID, 'about', true );
			if ( is_string( $about ) && trim( $about ) !== '' ) {
				$bucket['bios'][] = $about;
			}

			if ( ! $bucket['website'] ) {
				$bucket['website'] = trim( (string) get_post_meta( $interview->ID, 'webstie', true ) );
			}

			foreach ( [ 'instagram', 'twitter', 'facebook', 'tumblr', 'flickr', 'vsco_grid', 'vimeo', 'blog', 'bluesky', 'threads', 'linkedin' ] as $key2 ) {
				$value = trim( (string) get_post_meta( $interview->ID, $key2, true ) );
				if ( $value && empty( $bucket['socials'][ $key2 ] ) ) {
					$bucket['socials'][ $key2 ] = $value;
				}
			}

			if ( ! $bucket['portrait'] ) {
				$thumb_id = get_post_thumbnail_id( $interview->ID );
				if ( $thumb_id ) {
					$bucket['portrait'] = $thumb_id;
				}
			}
			unset( $bucket );
		}

		WP_CLI::log( sprintf( 'Deduplicated to %d unique photographers.', count( $photographers ) ) );

		$created = 0;
		$updated = 0;

		foreach ( $photographers as $data ) {
			$slug = sanitize_title( $data['name'] );
			$existing = get_page_by_path( $slug, OBJECT, 'photographer' );

			$bio = '';
			foreach ( $data['bios'] as $candidate ) {
				if ( strlen( $candidate ) > strlen( $bio ) ) {
					$bio = $candidate;
				}
			}

			$post_args = [
				'post_type'    => 'photographer',
				'post_status'  => 'publish',
				'post_title'   => $data['name'],
				'post_name'    => $slug,
				'post_content' => $bio,
			];

			if ( $existing ) {
				$post_args['ID'] = $existing->ID;
				if ( $dry_run ) {
					WP_CLI::log( sprintf( '[dry] would update %s (%d interviews)', $data['name'], count( $data['interview_ids'] ) ) );
				} else {
					wp_update_post( $post_args );
					$updated++;
				}
				$post_id = $existing->ID;
			} else {
				if ( $dry_run ) {
					WP_CLI::log( sprintf( '[dry] would create %s (%d interviews)', $data['name'], count( $data['interview_ids'] ) ) );
					continue;
				}
				$post_id = wp_insert_post( $post_args );
				if ( is_wp_error( $post_id ) ) {
					WP_CLI::warning( 'failed to insert ' . $data['name'] . ': ' . $post_id->get_error_message() );
					continue;
				}
				$created++;
			}

			if ( $data['website'] ) {
				update_post_meta( $post_id, 'website', $data['website'] );
			}
			foreach ( $data['socials'] as $platform => $value ) {
				update_post_meta( $post_id, $platform, $value );
			}
			if ( $data['portrait'] ) {
				set_post_thumbnail( $post_id, $data['portrait'] );
			}
			update_post_meta( $post_id, 'tpj_interview_count', count( $data['interview_ids'] ) );
		}

		if ( $dry_run ) {
			WP_CLI::success( 'Dry run complete.' );
		} else {
			WP_CLI::success( sprintf( 'Created %d, updated %d.', $created, $updated ) );
		}
	}

	/**
	 * Seed the 8 launch Collections.
	 *
	 * Collections are curated, so the *which articles* part is editorial
	 * and not fully automatable. This command creates the eight Collection
	 * CPT shells with the curator-written copy. Editors associate articles
	 * by hand in WP admin afterward.
	 *
	 * @when after_wp_load
	 */
	public function seed_collections() {
		$collections = [
			[
				'slug'      => 'rooms-of-long-lived-in',
				'title'     => 'Rooms of Long-Lived-In',
				'tagline'   => 'Eight essays on the spaces that have held people for a long time.',
				'count'     => 8,
				'note_h'    => 'Why these eight',
				'note'      => "We started this collection after we noticed a pattern in our archive. There was a kind of essay that kept turning up — slow, patient, set in interiors that were not staged but lived in. The grandmother's living room. The long quiet of a single house photographed for years. We had been calling these home essays in our internal notes, but home wasn't quite right. Home is a feeling. What these essays are about is something more specific: the architecture of long-term inhabitation.\n\nEight is an arbitrary number, of course. We could have made it twelve, or four. We chose eight because it felt like the right size for an evening of reading.",
			],
			[
				'slug'    => 'first-pictures',
				'title'   => 'First Pictures',
				'tagline' => 'Photographers on the photograph that started the work.',
				'count'   => 12,
				'note_h'  => 'On the photograph that started everything',
				'note'    => 'Every photographer has one. The picture before the practice, the accident before the intention.',
			],
			[
				'slug'    => 'after-dark',
				'title'   => 'After Dark',
				'tagline' => 'On the world that only shows up when the lights go out.',
				'count'   => 9,
				'note_h'  => 'What only shows itself at night',
				'note'    => 'Nine essays on what the dark reveals, and what it hides on purpose.',
			],
			[
				'slug'    => 'family-albums',
				'title'   => 'Family Albums',
				'tagline' => 'Inherited archives, gathered across thirteen years of TPJ.',
				'count'   => 14,
				'note_h'  => 'What we keep',
				'note'    => 'Fourteen essays drawn from over a decade of family-archive work in TPJ.',
			],
			[
				'slug'    => 'the-long-project',
				'title'   => 'The Long Project',
				'tagline' => 'Work that took years, told by the photographers who made it.',
				'count'   => 10,
				'note_h'  => 'On duration',
				'note'    => 'Ten essays on bodies of work that took five, ten, twenty years to make.',
			],
			[
				'slug'    => 'strangers',
				'title'   => 'Strangers',
				'tagline' => 'On photographing people you do not know, and what is owed.',
				'count'   => 11,
				'note_h'  => 'The transaction of the photograph',
				'note'    => 'Eleven essays on the ethics, intimacy, and rituals of photographing people you have never met.',
			],
			[
				'slug'    => 'light',
				'title'   => 'Light',
				'tagline' => 'Eleven essays on the simplest and most stubborn subject.',
				'count'   => 11,
				'note_h'  => 'The simplest and most stubborn subject',
				'note'    => 'Light is the only thing photography is actually about, and yet most essays about it become technical. These eleven do not.',
			],
			[
				'slug'    => 'first-interviews',
				'title'   => 'First Interviews',
				'tagline' => "Foundational conversations from TPJ's earliest years.",
				'count'   => 8,
				'note_h'  => 'Where TPJ began',
				'note'    => 'Eight conversations from the first three years of The Photographic Journal.',
			],
		];

		$created = 0;
		$updated = 0;

		foreach ( $collections as $c ) {
			$existing = get_page_by_path( $c['slug'], OBJECT, 'collection' );
			$args = [
				'post_type'    => 'collection',
				'post_status'  => 'publish',
				'post_title'   => $c['title'],
				'post_name'    => $c['slug'],
				'post_excerpt' => $c['tagline'],
				'post_content' => $c['note'],
			];

			if ( $existing ) {
				$args['ID'] = $existing->ID;
				wp_update_post( $args );
				$post_id = $existing->ID;
				$updated++;
			} else {
				$post_id = wp_insert_post( $args );
				if ( is_wp_error( $post_id ) ) {
					WP_CLI::warning( 'failed to insert ' . $c['title'] . ': ' . $post_id->get_error_message() );
					continue;
				}
				$created++;
			}

			update_post_meta( $post_id, 'tpj_target_count', $c['count'] );
			update_post_meta( $post_id, 'tpj_curators_note_heading', $c['note_h'] );
		}

		WP_CLI::success( sprintf( 'Collections — created %d, updated %d.', $created, $updated ) );
	}

	/**
	 * Parse the photographer blob from the end of essay/feature/interview
	 * post_content and convert it into structured Photographer records.
	 *
	 * The v1 pattern (from SQL inspection):
	 *   [last figure of the body]
	 *   <div class="circletar"></div>
	 *   <p style="text-align: center;"><strong>Name</strong> bio text...</p>
	 *   <p style="text-align: center;">More bio paragraphs...</p>
	 *
	 * The portrait image URL is stored in the per-post `custom_css` meta
	 * field as a CSS rule like `.circletar { background: url(...) ... }`.
	 *
	 * For each article that contains the marker:
	 *   - Extract photographer name from the first <strong>
	 *   - Extract bio HTML (all <p> after the marker)
	 *   - Pull portrait URL from custom_css
	 *   - Find/create a Photographer CPT record
	 *   - Link the article to it via the `tpj_photographer` meta
	 *   - Save the original block on the article in `tpj_photographer_blob`
	 *     so frontend can hide it if desired (non-destructive: post_content
	 *     is not modified)
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Print what would change without writing.
	 *
	 * [--type=<type>]
	 * : Limit to a single post type (essay|interview|feature). Default: all three.
	 *
	 * [--only=<ids>]
	 * : Comma-separated list of post IDs to process. Skips every other
	 * post. Use for surgical fixes (e.g. just-imported delta posts)
	 * without re-running the link write across the whole archive.
	 *
	 * @when after_wp_load
	 */
	public function migrate_photographer_blocks( $args, $assoc_args ) {
		$dry_run    = isset( $assoc_args['dry-run'] );
		$only_type  = isset( $assoc_args['type'] ) ? $assoc_args['type'] : null;
		$only_ids   = isset( $assoc_args['only'] )
			? array_filter( array_map( 'intval', explode( ',', $assoc_args['only'] ) ) )
			: null;
		$post_types = $only_type ? [ $only_type ] : [ 'essay', 'interview', 'feature' ];

		$total       = 0;
		$matched     = 0;
		$skipped     = 0;
		$photogs_new = 0;
		$photogs_use = 0;
		$linked      = 0;

		foreach ( $post_types as $post_type ) {
			$query_args = [
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'date',
				'order'          => 'DESC',
			];
			if ( $only_ids ) {
				$query_args['post__in'] = $only_ids;
			}
			$posts = get_posts( $query_args );

			WP_CLI::log( sprintf( 'Walking %d %s posts.', count( $posts ), $post_type ) );

			foreach ( $posts as $post ) {
				$total++;
				$parsed = tpj_parse_photographer_blob( $post );
				if ( ! $parsed ) {
					$skipped++;
					continue;
				}
				$matched++;

				// Multi-author guard: legacy blob extraction returns a
				// single name. If the article already credits two or more
				// photographers, rewriting the link list to one ID would
				// destroy collaboration credits set by apply-attribution
				// -audit / split-combo-photographers. Skip the link write
				// entirely; the bio/portrait still gets backfilled onto
				// the extracted photographer's CPT below.
				$existing_links = tpj_get_photographer_links( $post->ID );
				$skip_link_write = count( $existing_links ) >= 2;

				if ( $dry_run ) {
					WP_CLI::log( sprintf(
						'[dry] %s → "%s" (bio: %d chars, portrait: %s)%s',
						$post->post_name,
						$parsed['name'],
						strlen( $parsed['bio'] ),
						$parsed['portrait_url'] ? 'yes' : 'no',
						$skip_link_write ? ' [keeps multi-author links]' : ''
					) );
					continue;
				}

				$slug     = sanitize_title( $parsed['name'] );
				$existing = get_page_by_path( $slug, OBJECT, 'photographer' );

				if ( $existing ) {
					$photographer_id = $existing->ID;
					$photogs_use++;
					// Only fill empty fields, don't overwrite editorial work
					if ( ! $existing->post_content && $parsed['bio'] ) {
						wp_update_post( [
							'ID'           => $photographer_id,
							'post_content' => $parsed['bio'],
						] );
					}
				} else {
					$photographer_id = wp_insert_post( [
						'post_type'    => 'photographer',
						'post_status'  => 'publish',
						'post_title'   => $parsed['name'],
						'post_name'    => $slug,
						'post_content' => $parsed['bio'],
					] );
					if ( is_wp_error( $photographer_id ) ) {
						WP_CLI::warning( 'failed to insert ' . $parsed['name'] . ': ' . $photographer_id->get_error_message() );
						continue;
					}
					$photogs_new++;
				}

				if ( $parsed['portrait_url'] ) {
					$existing_url = get_post_meta( $photographer_id, 'tpj_portrait_url', true );
					if ( ! $existing_url ) {
						update_post_meta( $photographer_id, 'tpj_portrait_url', $parsed['portrait_url'] );
					}
				}

				if ( ! $skip_link_write ) {
					tpj_set_photographer_links( $post->ID, [ $photographer_id ] );
					$linked++;
				}
				update_post_meta( $post->ID, 'tpj_photographer_blob_html', $parsed['blob'] );
			}
		}

		if ( $dry_run ) {
			WP_CLI::success( sprintf(
				'Dry run complete. Walked %d, matched %d, skipped %d.',
				$total, $matched, $skipped
			) );
		} else {
			WP_CLI::success( sprintf(
				'Walked %d, matched %d, skipped %d. Photographers: %d new, %d existing reused. Articles linked: %d.',
				$total, $matched, $skipped, $photogs_new, $photogs_use, $linked
			) );
		}
	}

	/**
	 * Scan photographer bios for credit-line remnants the cleanup may
	 * have missed — phrases like "model", "stylist", "hair", "makeup",
	 * etc. mid-paragraph or in unusual phrasings. Prints each hit with
	 * the photographer slug and the offending sentence for review.
	 *
	 * ## OPTIONS
	 *
	 * [--keyword=<word>]
	 * : Limit scan to one keyword instead of the full set.
	 *
	 * @when after_wp_load
	 */
	public function audit_photographer_bios( $args, $assoc_args ) {
		$only_keyword = $assoc_args['keyword'] ?? null;

		$keywords = [
			'model'              => '/\bmodels?\b/i',
			'stylist'            => '/\bstylist\b/i',
			'styling'            => '/\bstyling\b/i',
			'hair'               => '/\bhair\b/i',
			'makeup'             => '/\bmake[\s-]?up\b/i',
			'wardrobe'           => '/\bwardrobe\b/i',
			'words by'           => '/\bwords\s+by\b/i',
			'art direction'      => '/\bart\s+direction\b/i',
			'produced by'        => '/\bproduced\s+by\b/i',
			'production'         => '/\bproduction\b/i',
			'special thanks'    => '/\bspecial\s+thanks\b/i',
			'thanks to'          => '/\bthanks\s+to\b/i',
			'collaboration with' => '/\bin\s+collaboration\s+with\b/i',
			'partnership with'   => '/\bpartnership\s+with\b/i',
			'assistant'          => '/\bassistants?\b/i',
			'assisted by'        => '/\bassisted\s+by\b/i',
			'subject'            => '/\bsubjects?\b/i',
			'set design'         => '/\bset\s+design(?:er)?\b/i',
		];

		if ( $only_keyword ) {
			if ( ! isset( $keywords[ $only_keyword ] ) ) {
				WP_CLI::error( sprintf(
					'Unknown keyword: %s. Available: %s',
					$only_keyword,
					implode( ', ', array_keys( $keywords ) )
				) );
			}
			$keywords = [ $only_keyword => $keywords[ $only_keyword ] ];
		}

		$photographers = get_posts( [
			'post_type'      => 'photographer',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		] );

		WP_CLI::log( sprintf( 'Scanning %d photographers for %d keyword%s…',
			count( $photographers ),
			count( $keywords ),
			count( $keywords ) === 1 ? '' : 's'
		) );

		$hits_by_keyword = array_fill_keys( array_keys( $keywords ), [] );

		foreach ( $photographers as $photog ) {
			$plain = trim( wp_strip_all_tags( (string) $photog->post_content ) );
			if ( $plain === '' ) continue;

			foreach ( $keywords as $label => $pattern ) {
				if ( ! preg_match( $pattern, $plain ) ) continue;
				$snippet = tpj_extract_match_snippet( $plain, $pattern );
				$hits_by_keyword[ $label ][] = [
					'slug'    => $photog->post_name,
					'snippet' => $snippet,
				];
			}
		}

		foreach ( $hits_by_keyword as $label => $hits ) {
			if ( empty( $hits ) ) continue;
			WP_CLI::log( '' );
			WP_CLI::log( sprintf( '== %s (%d) ==', strtoupper( $label ), count( $hits ) ) );
			foreach ( $hits as $hit ) {
				WP_CLI::log( sprintf( '  %s: %s', $hit['slug'], $hit['snippet'] ) );
			}
		}

		$total_hits = array_sum( array_map( 'count', $hits_by_keyword ) );
		WP_CLI::log( '' );
		WP_CLI::success( sprintf(
			'Scanned %d photographers. Total hits: %d across %d keyword%s.',
			count( $photographers ),
			$total_hits,
			count( array_filter( $hits_by_keyword ) ),
			count( array_filter( $hits_by_keyword ) ) === 1 ? '' : 's'
		) );
	}

	/**
	 * Walk every Photographer post, pull <a> links out of the bio HTML,
	 * route each URL into the matching social/website meta field, and
	 * write the bio back without the link markup. Existing meta values
	 * are preserved (first-write wins) so any manual edits stick.
	 *
	 * Categorization is host-based:
	 *   instagram.com / instagr.am  -> instagram
	 *   twitter.com / x.com         -> twitter
	 *   facebook.com / fb.com       -> facebook
	 *   tumblr.com                  -> tumblr
	 *   flickr.com                  -> flickr
	 *   vsco.co                     -> vsco_grid
	 *   vimeo.com                   -> vimeo
	 *   bsky.app / bsky.social      -> bluesky
	 *   threads.net / threads.com   -> threads
	 *   linkedin.com                -> linkedin
	 *   blogspot.com / wordpress.com / medium.com -> blog
	 *   anything else               -> website
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Print what would change without writing.
	 *
	 * @when after_wp_load
	 */
	public function clean_photographer_bios( $args, $assoc_args ) {
		$dry_run = isset( $assoc_args['dry-run'] );

		$photographers = get_posts( [
			'post_type'      => 'photographer',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
		] );

		WP_CLI::log( sprintf( 'Walking %d photographers…', count( $photographers ) ) );

		$total = 0;
		$bios_cleaned = 0;
		$links_total = 0;
		$meta_written = 0;
		$skipped_existing = 0;

		foreach ( $photographers as $photog ) {
			$total++;
			$original = (string) $photog->post_content;
			if ( $original === '' ) continue;

			$result = tpj_extract_links_from_bio( $original );
			$links = $result['links'];
			$cleaned = $result['cleaned_html'];

			$wrote_for_this = [];
			foreach ( $links as $key => $url ) {
				$existing = get_post_meta( $photog->ID, $key, true );
				if ( is_string( $existing ) && trim( $existing ) !== '' ) {
					$skipped_existing++;
					continue;
				}
				if ( ! $dry_run ) {
					update_post_meta( $photog->ID, $key, $url );
				}
				$wrote_for_this[] = $key;
				$meta_written++;
			}

			$bio_changed = $cleaned !== $original;
			if ( $bio_changed && ! $dry_run ) {
				wp_update_post( [
					'ID'           => $photog->ID,
					'post_content' => $cleaned,
				] );
			}
			if ( $bio_changed ) $bios_cleaned++;

			$links_total += count( $links );

			if ( $dry_run && ( count( $links ) > 0 || $bio_changed ) ) {
				WP_CLI::log( sprintf(
					'[dry] %s — meta: %s; bio: %s',
					$photog->post_name ?: '(no slug)',
					empty( $wrote_for_this ) ? 'none' : implode( ',', $wrote_for_this ),
					$bio_changed ? 'cleaned' : 'unchanged'
				) );
			}
		}

		$summary = sprintf(
			'Walked %d photographers. Bios cleaned: %d. Links extracted: %d. Meta written: %d. Skipped (already set): %d.',
			$total, $bios_cleaned, $links_total, $meta_written, $skipped_existing
		);

		if ( $dry_run ) {
			WP_CLI::success( 'Dry run. ' . $summary );
		} else {
			WP_CLI::success( $summary );
		}
	}

	/**
	 * Backfill: create Photographer CPT records and `tpj_photographer`
	 * links for every essay / interview / feature that has a
	 * photographer credit (via the `photographer` meta or first tag)
	 * but no linked record yet. After running, every article carrying
	 * a name appears on the photographers index with a real CPT post.
	 *
	 * Idempotent: subsequent runs find every article already linked and
	 * skip them.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview the plan without writing.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj backfill-phantom-photographers --dry-run
	 *   wp tpj backfill-phantom-photographers
	 */
	public static function backfill_phantom_photographers( $args, $assoc_args ) {
		$dry_run = ! empty( $assoc_args['dry-run'] );

		$created = 0;
		$reused  = 0;
		$linked  = 0;
		$skipped_no_name = 0;

		foreach ( [ 'essay', 'interview', 'feature' ] as $post_type ) {
			$query = new WP_Query( [
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			] );

			WP_CLI::log( sprintf( 'Walking %d %s posts.', count( $query->posts ), $post_type ) );

			foreach ( $query->posts as $post_id ) {
				$existing_link  = (int) get_post_meta( $post_id, 'tpj_photographer', true );
				$existing_post  = $existing_link > 0 ? get_post( $existing_link ) : null;
				$still_valid    = $existing_post
					&& $existing_post->post_type === 'photographer'
					&& $existing_post->post_status === 'publish';
				if ( $still_valid ) {
					continue;
				}

				$name = self::resolve_photographer_name_for_post( $post_id );
				if ( $name === '' ) {
					$skipped_no_name++;
					continue;
				}

				$result = self::find_or_create_photographer( $name, $dry_run );
				if ( ! $result ) {
					WP_CLI::warning( sprintf( 'Failed to create photographer "%s" for %s #%d.', $name, $post_type, $post_id ) );
					continue;
				}

				if ( $result['created'] ) {
					$created++;
				} else {
					$reused++;
				}

				if ( $dry_run ) {
					WP_CLI::log( sprintf(
						'[dry] %s %s #%d → "%s" (%s)',
						$result['created'] ? 'create+link' : 'link',
						$post_type, $post_id, $name,
						$result['created'] ? 'new' : sprintf( '#%d', $result['id'] )
					) );
				} else {
					tpj_set_photographer_links( $post_id, [ (int) $result['id'] ] );
				}
				$linked++;
			}
		}

		$summary = sprintf(
			'Linked %d articles. Created %d new photographers. Reused %d existing. %d articles had no resolvable name.',
			$linked, $created, $reused, $skipped_no_name
		);

		if ( $dry_run ) {
			WP_CLI::success( '[dry run] ' . $summary );
		} else {
			WP_CLI::success( $summary );
		}
	}

	/**
	 * Resolve a photographer name from an article. Delegates to the
	 * shared `tpj_resolve_photographer_name` so the CLI and the
	 * GraphQL resolver agree about who is and isn't a real name. Empty
	 * string return signals "no resolvable name".
	 */
	private static function resolve_photographer_name_for_post( $post_id ) {
		$name = tpj_resolve_photographer_name( $post_id );
		return is_string( $name ) ? $name : '';
	}

	/**
	 * Export an attribution audit CSV: every essay/interview/feature
	 * with an attribution problem, plus a clickable URL and blank
	 * columns for editorial corrections. Default output skips healthy
	 * articles (where the linked record's title matches the resolved
	 * name); pass --all to include everything.
	 *
	 * Flag column meanings:
	 *   no-resolvable-name  — no `photographer` meta and no name-shaped
	 *                          tag; can't auto-attribute.
	 *   unlinked            — has a name but no `tpj_photographer`
	 *                          link.
	 *   broken-link         — linked record is trashed or missing.
	 *   mismatch            — linked record's title doesn't match the
	 *                          resolved name.
	 *   multi-author        — `photographer` meta names multiple people.
	 *
	 * Workflow: run the export, open in a spreadsheet, fill in the
	 * `intended_photographer` column for rows you want to fix and
	 * `notes` for context. Send back, we apply via a matching import.
	 *
	 * ## OPTIONS
	 *
	 * [--base=<url>]
	 * : URL base for the article links column. Default: http://localhost:3000
	 *
	 * [--all]
	 * : Include healthy rows too (where the resolver matches the link).
	 *   Default omits them.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj export-attribution-audit > audit.csv
	 *   wp tpj export-attribution-audit --base=https://thephotographicjournal.com > audit.csv
	 *   wp tpj export-attribution-audit --all > audit-full.csv
	 */
	public static function export_attribution_audit( $args, $assoc_args ) {
		$base = isset( $assoc_args['base'] ) ? rtrim( (string) $assoc_args['base'], '/' ) : 'http://localhost:3000';
		$include_all = ! empty( $assoc_args['all'] );

		$headers = [
			'post_id', 'type', 'url', 'slug', 'title', 'date',
			'photographer_meta', 'tags', 'linked_photographer',
			'flag', 'intended_photographer', 'notes',
		];
		WP_CLI::log( implode( ',', $headers ) );

		$rows_emitted = 0;
		foreach ( [ 'essay', 'interview', 'feature' ] as $post_type ) {
			$query = new WP_Query( [
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			] );

			foreach ( $query->posts as $post ) {
				$meta = get_post_meta( $post->ID, 'photographer', true );
				$meta = is_string( $meta ) ? $meta : '';
				$tags = wp_get_post_tags( $post->ID );
				$tag_names = array_map( function ( $t ) { return $t->name; }, $tags );

				$current_link = (int) get_post_meta( $post->ID, 'tpj_photographer', true );
				$current_post = $current_link > 0 ? get_post( $current_link ) : null;
				$linked_valid = $current_post
					&& $current_post->post_type === 'photographer'
					&& $current_post->post_status === 'publish';
				$linked_title = $linked_valid ? $current_post->post_title : '';

				$resolved = tpj_resolve_photographer_name( $post->ID );

				$flag = '';
				if ( $meta !== '' && preg_match( '/(,|;|\s+&\s+|\s+and\s+)/i', $meta ) ) {
					$cleaned = tpj_sanitize_photographer_meta_value( $meta );
					if ( $cleaned !== null && preg_match( '/(,|;|\s+&\s+|\s+and\s+)/i', $cleaned ) ) {
						$flag = 'multi-author';
					}
				}
				if ( $flag === '' ) {
					if ( $resolved === null ) {
						$flag = 'no-resolvable-name';
					} elseif ( $current_link > 0 && ! $linked_valid ) {
						$flag = 'broken-link';
					} elseif ( ! $linked_valid ) {
						$flag = 'unlinked';
					} elseif ( strcasecmp( trim( (string) $current_post->post_title ), trim( $resolved ) ) !== 0 ) {
						$flag = 'mismatch';
					}
				}

				if ( $flag === '' && ! $include_all ) {
					continue;
				}

				$row = [
					$post->ID,
					$post_type,
					$base . '/' . $post_type . '/' . $post->post_name,
					$post->post_name,
					$post->post_title,
					substr( (string) $post->post_date, 0, 10 ),
					$meta,
					implode( ' | ', $tag_names ),
					$linked_title,
					$flag === '' ? 'ok' : $flag,
					'',
					'',
				];
				WP_CLI::log( self::csv_row( $row ) );
				$rows_emitted++;
			}
		}

		// stderr breadcrumb so the count is visible without polluting
		// the CSV body when piped to a file.
		fwrite( STDERR, sprintf( "Exported %d row%s.\n", $rows_emitted, $rows_emitted === 1 ? '' : 's' ) );
	}

	/**
	 * CSV row helper: quotes fields that contain comma, quote, or newline.
	 */
	private static function csv_row( $values ) {
		$out = [];
		foreach ( $values as $v ) {
			$s = (string) $v;
			if ( strpbrk( $s, ",\"\n\r" ) !== false ) {
				$s = '"' . str_replace( '"', '""', $s ) . '"';
			}
			$out[] = $s;
		}
		return implode( ',', $out );
	}

	/**
	 * Find articles where a photographer's name appears (in meta, tags,
	 * or body content) but isn't the linked attribution. Useful for
	 * identifying contributions that the migration heuristics missed.
	 *
	 * Tiers, strongest signal first:
	 *   META    — name is in `photographer` post meta but the article is
	 *             linked to a different Photographer record
	 *   TAG     — name appears as a tag on the article but the article
	 *             is linked to someone else (or unlinked)
	 *   BODY    — name appears in the article's content but not in meta
	 *             or tags; weakest signal, may be a coincidence
	 *
	 * ## OPTIONS
	 *
	 * --name=<name>
	 * : Photographer name to look for (e.g., "Agustin Sanchez").
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj find-uncredited-articles --name="Agustin Sanchez"
	 *   wp tpj find-uncredited-articles --name="Lou Noble"
	 */
	public static function find_uncredited_articles( $args, $assoc_args ) {
		$name = isset( $assoc_args['name'] ) ? trim( (string) $assoc_args['name'] ) : '';
		if ( $name === '' ) {
			WP_CLI::error( '--name=<name> is required.' );
		}

		global $wpdb;

		$slug   = sanitize_title( $name );
		$photog = get_page_by_path( $slug, OBJECT, 'photographer' );

		$linked_ids = [];
		if ( $photog && $photog->post_type === 'photographer' ) {
			$linked_q = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $photog->ID,
				'fields'         => 'ids',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			] );
			$linked_ids = array_map( 'intval', $linked_q->posts );
			WP_CLI::log( sprintf( '"%s" (#%d) is currently linked to %d article%s.',
				$photog->post_title, $photog->ID,
				count( $linked_ids ), count( $linked_ids ) === 1 ? '' : 's' ) );
		} else {
			WP_CLI::log( sprintf( 'No Photographer record exists for "%s" yet.', $name ) );
		}
		$linked_set = array_flip( $linked_ids );

		$row_lookup = function ( $id ) {
			$post = get_post( $id );
			if ( ! $post ) return null;
			$meta = get_post_meta( $id, 'photographer', true );
			$current_link  = (int) get_post_meta( $id, 'tpj_photographer', true );
			$current_post  = $current_link > 0 ? get_post( $current_link ) : null;
			$current_title = $current_post && $current_post->post_type === 'photographer'
				? $current_post->post_title
				: '(unlinked)';
			return [
				'id'       => (int) $id,
				'type'     => $post->post_type,
				'title'    => $post->post_title,
				'slug'     => $post->post_name,
				'meta'     => is_string( $meta ) ? $meta : '',
				'linked'   => $current_title,
			];
		};

		// Tier 1: name appears in photographer meta (substring match,
		// case-insensitive) but article isn't linked to the canonical record.
		$like = '%' . $wpdb->esc_like( $name ) . '%';
		$meta_rows = $wpdb->get_col( $wpdb->prepare(
			"SELECT pm.post_id
			 FROM {$wpdb->postmeta} pm
			 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			 WHERE pm.meta_key = 'photographer'
			   AND pm.meta_value LIKE %s
			   AND p.post_type IN ('essay','interview','feature')
			   AND p.post_status = 'publish'",
			$like
		) );
		$meta_matches = [];
		foreach ( $meta_rows as $id ) {
			$id = (int) $id;
			if ( isset( $linked_set[ $id ] ) ) continue;
			$row = $row_lookup( $id );
			if ( $row ) $meta_matches[] = $row;
		}

		// Tier 2: tagged with the name but not linked.
		$tag_matches = [];
		$tag = get_term_by( 'name', $name, 'post_tag' );
		if ( $tag ) {
			$tag_q = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'tax_query'      => [ [
					'taxonomy' => 'post_tag',
					'field'    => 'term_id',
					'terms'    => $tag->term_id,
				] ],
				'fields'         => 'ids',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			] );
			$seen_in_meta = array_flip( array_map( function ( $r ) { return $r['id']; }, $meta_matches ) );
			foreach ( $tag_q->posts as $id ) {
				$id = (int) $id;
				if ( isset( $linked_set[ $id ] ) ) continue;
				if ( isset( $seen_in_meta[ $id ] ) ) continue;
				$row = $row_lookup( $id );
				if ( $row ) $tag_matches[] = $row;
			}
		}

		// Tier 3: name appears in body content only.
		$body_rows = $wpdb->get_col( $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts}
			 WHERE post_type IN ('essay','interview','feature')
			   AND post_status = 'publish'
			   AND post_content LIKE %s",
			$like
		) );
		$body_matches = [];
		$seen_already = array_flip( array_merge(
			array_map( function ( $r ) { return $r['id']; }, $meta_matches ),
			array_map( function ( $r ) { return $r['id']; }, $tag_matches )
		) );
		foreach ( $body_rows as $id ) {
			$id = (int) $id;
			if ( isset( $linked_set[ $id ] ) ) continue;
			if ( isset( $seen_already[ $id ] ) ) continue;
			$row = $row_lookup( $id );
			if ( $row ) $body_matches[] = $row;
		}

		$total = count( $meta_matches ) + count( $tag_matches ) + count( $body_matches );
		if ( $total === 0 ) {
			WP_CLI::success( sprintf( 'No additional uncredited matches for "%s".', $name ) );
			return;
		}

		$print_row = function ( $r ) {
			WP_CLI::log( sprintf( '  %s "%s" (#%d, slug=%s)',
				ucfirst( $r['type'] ), $r['title'], $r['id'], $r['slug'] ) );
			if ( $r['meta'] !== '' ) {
				WP_CLI::log( sprintf( '    photographer meta: "%s"', $r['meta'] ) );
			}
			WP_CLI::log( sprintf( '    currently linked: %s', $r['linked'] ) );
		};

		WP_CLI::log( '' );
		if ( ! empty( $meta_matches ) ) {
			WP_CLI::log( sprintf( '== META — name in `photographer` meta but linked elsewhere (%d) ==',
				count( $meta_matches ) ) );
			foreach ( $meta_matches as $r ) $print_row( $r );
			WP_CLI::log( '' );
		}
		if ( ! empty( $tag_matches ) ) {
			WP_CLI::log( sprintf( '== TAG — tagged with "%s" but linked elsewhere (%d) ==',
				$name, count( $tag_matches ) ) );
			foreach ( $tag_matches as $r ) $print_row( $r );
			WP_CLI::log( '' );
		}
		if ( ! empty( $body_matches ) ) {
			WP_CLI::log( sprintf( '== BODY — name appears in body, not in meta or tags (%d) ==',
				count( $body_matches ) ) );
			foreach ( $body_matches as $r ) $print_row( $r );
			WP_CLI::log( '' );
		}

		WP_CLI::log( 'To attribute one of these:' );
		WP_CLI::log( sprintf( '  wp tpj set-photographer --slug=<article-slug> --name="%s"', $name ) );
		WP_CLI::log( '  wp tpj relink-photographers' );
	}

	/**
	 * Audit Photographer CPT records. Lists every record with its
	 * linked-article count and any data-quality flags. Useful for
	 * reviewing the index after a relink/merge pass and identifying
	 * records that need attention.
	 *
	 * Flags:
	 *   single-word   — title is one word; could be a mononym OR a topic
	 *   has-digit     — title contains a digit; rare for real names
	 *   multi-name    — title contains comma / & / "and"; suggests the
	 *                   record was created from a multi-author credit
	 *   orphan        — zero linked articles
	 *
	 * ## OPTIONS
	 *
	 * [--slug=<slug>]
	 * : Drill into one photographer. Lists every article linked to them.
	 *
	 * [--csv]
	 * : Output as CSV (id,title,slug,article_count,flags) for piping to a file.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj audit-photographers
	 *   wp tpj audit-photographers --csv > photographers.csv
	 *   wp tpj audit-photographers --slug=will-malone
	 */
	public static function audit_photographers( $args, $assoc_args ) {
		$single_slug = isset( $assoc_args['slug'] ) ? trim( (string) $assoc_args['slug'] ) : '';
		$csv = ! empty( $assoc_args['csv'] );

		if ( $single_slug !== '' ) {
			$photog = get_page_by_path( $single_slug, OBJECT, 'photographer' );
			if ( ! $photog || $photog->post_type !== 'photographer' ) {
				WP_CLI::error( sprintf( 'Photographer "%s" not found.', $single_slug ) );
			}
			$linked = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $photog->ID,
				'orderby'        => 'date',
				'order'          => 'DESC',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			] );
			WP_CLI::log( sprintf( '"%s" (#%d, slug=%s) — %d linked article%s',
				$photog->post_title, $photog->ID, $photog->post_name,
				count( $linked->posts ), count( $linked->posts ) === 1 ? '' : 's' ) );
			foreach ( $linked->posts as $post ) {
				WP_CLI::log( sprintf( '  [%-9s] %s — %s',
					$post->post_type,
					get_the_date( 'Y-m-d', $post ),
					$post->post_title
				) );
			}
			return;
		}

		$query = new WP_Query( [
			'post_type'      => 'photographer',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'no_found_rows'  => true,
		] );

		$rows = [];
		foreach ( $query->posts as $p ) {
			$linked = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $p->ID,
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'no_found_rows'  => false,
			] );
			$count = (int) $linked->found_posts;

			$flags = [];
			if ( ! preg_match( '/\s/', $p->post_title ) ) $flags[] = 'single-word';
			if ( preg_match( '/\d/', $p->post_title ) ) $flags[] = 'has-digit';
			if ( preg_match( '/(,|;|\s+&\s+|\s+and\s+)/i', $p->post_title ) ) $flags[] = 'multi-name';
			if ( $count === 0 ) $flags[] = 'orphan';

			$rows[] = [
				'id'    => $p->ID,
				'title' => $p->post_title,
				'slug'  => $p->post_name,
				'count' => $count,
				'flags' => $flags,
			];
		}

		usort( $rows, function ( $a, $b ) {
			return strcasecmp( $a['title'], $b['title'] );
		} );

		if ( $csv ) {
			WP_CLI::log( 'id,title,slug,article_count,flags' );
			foreach ( $rows as $r ) {
				WP_CLI::log( sprintf( '%d,"%s",%s,%d,"%s"',
					$r['id'],
					str_replace( '"', '""', $r['title'] ),
					$r['slug'],
					$r['count'],
					implode( ';', $r['flags'] )
				) );
			}
			return;
		}

		foreach ( $rows as $r ) {
			$flag_str = empty( $r['flags'] ) ? '' : ' [' . implode( ',', $r['flags'] ) . ']';
			WP_CLI::log( sprintf( '%4d  %-40s %s',
				$r['count'],
				$r['title'],
				$flag_str
			) );
		}
		WP_CLI::log( '' );
		WP_CLI::log( sprintf( '%d total records.', count( $rows ) ) );
	}

	/**
	 * Find essays / interviews / features whose `photographer` post meta
	 * names multiple people (separated by comma, semicolon, ampersand,
	 * or " and "). The current data model attributes each article to a
	 * single Photographer record, so multi-author articles only credit
	 * one of the contributors. Use this command to surface them so they
	 * can either be edited (pick one canonical author) or treated as
	 * input to a future multi-attribution feature.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj find-multi-photographer-articles
	 */
	public static function find_multi_photographer_articles( $args, $assoc_args ) {
		$candidates = [];
		foreach ( [ 'essay', 'interview', 'feature' ] as $post_type ) {
			$query = new WP_Query( [
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			] );
			foreach ( $query->posts as $post_id ) {
				$raw = get_post_meta( $post_id, 'photographer', true );
				if ( ! is_string( $raw ) || trim( $raw ) === '' ) continue;
				$cleaned = tpj_sanitize_photographer_meta_value( $raw );
				if ( $cleaned === null ) continue;
				if ( ! preg_match( '/(,|;|\s+&\s+|\s+and\s+)/i', $cleaned ) ) continue;

				$names = preg_split( '/\s*(?:,|;|\s+&\s+|\s+and\s+)\s*/i', $cleaned );
				$names = array_values( array_filter( array_map( 'trim', $names ) ) );
				if ( count( $names ) < 2 ) continue;

				$current_link = (int) get_post_meta( $post_id, 'tpj_photographer', true );
				$current_post = $current_link > 0 ? get_post( $current_link ) : null;
				$current_title = $current_post && $current_post->post_type === 'photographer'
					? $current_post->post_title
					: '(unlinked)';

				$candidates[] = [
					'id'      => $post_id,
					'type'    => $post_type,
					'title'   => get_the_title( $post_id ),
					'slug'    => get_post_field( 'post_name', $post_id ),
					'raw'     => $raw,
					'names'   => $names,
					'current' => $current_title,
				];
			}
		}

		if ( empty( $candidates ) ) {
			WP_CLI::success( 'No multi-photographer articles found.' );
			return;
		}

		WP_CLI::log( sprintf( 'Found %d article%s with multi-author attribution:',
			count( $candidates ), count( $candidates ) === 1 ? '' : 's' ) );

		foreach ( $candidates as $c ) {
			WP_CLI::log( '' );
			WP_CLI::log( sprintf( '%s "%s" (#%d, slug=%s)',
				ucfirst( $c['type'] ), $c['title'], $c['id'], $c['slug'] ) );
			WP_CLI::log( sprintf( '  meta:    "%s"', $c['raw'] ) );
			WP_CLI::log( sprintf( '  parsed:  %s', implode( ' | ', $c['names'] ) ) );
			WP_CLI::log( sprintf( '  linked:  %s', $c['current'] ) );
		}
	}

	/**
	 * Set the `photographer` post meta on a specific article so the
	 * resolver picks up the correct name. Use when an article has no
	 * `photographer` field set in WP admin and no name-shaped tag, so
	 * the contributor would otherwise stay unattributed. After
	 * setting, re-run `wp tpj relink-photographers` to point the
	 * article's link at the right Photographer record(s).
	 *
	 * Multi-author credits are supported by passing the joined string —
	 * "Annika White & Carl Knight", "X and Y", or "X, Y, Z". The
	 * resolver splits these on the same separators when reading.
	 *
	 * ## OPTIONS
	 *
	 * --slug=<slug>
	 * : Article slug (e.g., in-the-shallows).
	 *
	 * --name=<name>
	 * : Photographer credit. One name, or several joined with " & ",
	 *   " and ", commas, or semicolons.
	 *
	 * [--type=<type>]
	 * : Article type. One of: essay, interview, feature, any. Default any.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj set-photographer --slug=in-the-shallows --name="Agustin Sanchez"
	 *   wp tpj set-photographer --slug=moments-before-checkout --name="Annika White & Carl Knight"
	 */
	public static function set_photographer( $args, $assoc_args ) {
		$slug = isset( $assoc_args['slug'] ) ? trim( (string) $assoc_args['slug'] ) : '';
		$name = isset( $assoc_args['name'] ) ? trim( (string) $assoc_args['name'] ) : '';
		$type = isset( $assoc_args['type'] ) ? (string) $assoc_args['type'] : 'any';

		if ( $slug === '' || $name === '' ) {
			WP_CLI::error( 'Both --slug=<slug> and --name=<name> are required.' );
		}

		$types = $type === 'any' ? [ 'essay', 'interview', 'feature' ] : [ $type ];
		$found = null;
		foreach ( $types as $t ) {
			$post = get_page_by_path( $slug, OBJECT, $t );
			if ( $post ) {
				$found = $post;
				break;
			}
		}
		if ( ! $found ) {
			WP_CLI::error( sprintf( 'No essay/interview/feature found for slug "%s".', $slug ) );
		}

		// Persist a normalized join so the meta value matches what the
		// resolver, audit, and any future export expect.
		$normalized = tpj_join_photographer_names( tpj_split_photographer_names( $name ) );
		if ( $normalized === '' ) {
			$normalized = $name;
		}
		update_post_meta( $found->ID, 'photographer', $normalized );

		$parts = tpj_split_photographer_names( $normalized );
		$is_multi = count( $parts ) > 1;
		WP_CLI::success( sprintf(
			'Set photographer="%s" on %s "%s" (#%d)%s. Run `wp tpj relink-photographers` to update the link.',
			$normalized, $found->post_type, $found->post_title, $found->ID,
			$is_multi ? sprintf( ' [%d-author credit]', count( $parts ) ) : ''
		) );
	}

	/**
	 * List Photographer records that look like potential duplicates,
	 * grouped by match type so the strongest signals come first:
	 *
	 *   EXACT       — normalized titles match (case/punctuation only)
	 *   SUBSTRING   — one normalized title fully contains another
	 *                 ("Kate Sweeney" inside "Kate M Sweeney")
	 *   FUZZY       — Levenshtein distance ≤ 2 ("Will Malone" / "Wil Malone")
	 *
	 * For each group/pair, suggests a `merge-photographers` command
	 * keeping the record with more linked articles.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj find-photographer-dupes
	 */
	public static function find_photographer_dupes( $args, $assoc_args ) {
		$query = new WP_Query( [
			'post_type'      => 'photographer',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'no_found_rows'  => true,
		] );

		$records = [];
		foreach ( $query->posts as $p ) {
			$key = strtolower( preg_replace( '/[^a-z0-9]/i', '', (string) $p->post_title ) );
			if ( $key === '' ) continue;
			$records[] = [ 'post' => $p, 'key' => $key ];
		}

		// Tier 1: exact normalized matches.
		$exact_groups = [];
		foreach ( $records as $r ) {
			$exact_groups[ $r['key'] ][] = $r['post'];
		}
		$exact_groups = array_filter( $exact_groups, function ( $g ) {
			return count( $g ) >= 2;
		} );
		$excluded_ids = [];
		foreach ( $exact_groups as $g ) {
			foreach ( $g as $p ) $excluded_ids[ $p->ID ] = true;
		}

		$count_records = count( $records );

		// Tier 2: substring matches. One key fully contained in another,
		// minimum length 5 to avoid noise from short common roots.
		$substring_pairs = [];
		for ( $i = 0; $i < $count_records; $i++ ) {
			if ( isset( $excluded_ids[ $records[ $i ]['post']->ID ] ) ) continue;
			for ( $j = $i + 1; $j < $count_records; $j++ ) {
				if ( isset( $excluded_ids[ $records[ $j ]['post']->ID ] ) ) continue;
				$a = $records[ $i ];
				$b = $records[ $j ];
				if ( $a['key'] === $b['key'] ) continue;
				$shorter = strlen( $a['key'] ) <= strlen( $b['key'] ) ? $a : $b;
				$longer  = strlen( $a['key'] ) <= strlen( $b['key'] ) ? $b : $a;
				if ( strlen( $shorter['key'] ) < 5 ) continue;
				if ( strpos( $longer['key'], $shorter['key'] ) !== false ) {
					$substring_pairs[] = [ $a['post'], $b['post'] ];
				}
			}
		}
		foreach ( $substring_pairs as $pair ) {
			$excluded_ids[ $pair[0]->ID ] = true;
			$excluded_ids[ $pair[1]->ID ] = true;
		}

		// Tier 3: Levenshtein distance ≤ 2. Skip very short keys to
		// avoid pairing common short names ("li", "wu").
		$fuzzy_pairs = [];
		for ( $i = 0; $i < $count_records; $i++ ) {
			if ( isset( $excluded_ids[ $records[ $i ]['post']->ID ] ) ) continue;
			for ( $j = $i + 1; $j < $count_records; $j++ ) {
				if ( isset( $excluded_ids[ $records[ $j ]['post']->ID ] ) ) continue;
				$a = $records[ $i ];
				$b = $records[ $j ];
				if ( $a['key'] === $b['key'] ) continue;
				if ( strlen( $a['key'] ) < 6 || strlen( $b['key'] ) < 6 ) continue;
				if ( strlen( $a['key'] ) > 200 || strlen( $b['key'] ) > 200 ) continue;
				$d = levenshtein( $a['key'], $b['key'] );
				if ( $d > 0 && $d <= 2 ) {
					$fuzzy_pairs[] = [ $a['post'], $b['post'], $d ];
				}
			}
		}

		$count_for = function ( $id ) {
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
		};

		$print_record = function ( $p ) use ( $count_for ) {
			WP_CLI::log( sprintf( '  "%s" (#%d, slug=%s, %d articles)',
				$p->post_title, $p->ID, $p->post_name, $count_for( $p->ID ) ) );
		};

		$print_pair_command = function ( $pair ) use ( $count_for ) {
			$a_count = $count_for( $pair[0]->ID );
			$b_count = $count_for( $pair[1]->ID );
			$keep   = $a_count >= $b_count ? $pair[0] : $pair[1];
			$remove = $a_count >= $b_count ? $pair[1] : $pair[0];
			WP_CLI::log( sprintf( '    → wp tpj merge-photographers --keep=%s --remove=%s',
				$keep->post_name, $remove->post_name ) );
		};

		$total = count( $exact_groups ) + count( $substring_pairs ) + count( $fuzzy_pairs );
		if ( $total === 0 ) {
			WP_CLI::success( 'No likely duplicates found.' );
			return;
		}

		if ( ! empty( $exact_groups ) ) {
			WP_CLI::log( sprintf( '== EXACT (case/punctuation only) — %d group%s ==',
				count( $exact_groups ), count( $exact_groups ) === 1 ? '' : 's' ) );
			foreach ( $exact_groups as $group ) {
				WP_CLI::log( '' );
				foreach ( $group as $p ) {
					$print_record( $p );
				}
				$slugs = array_map( function ( $p ) { return $p->post_name; }, $group );
				$counts = array_map( $count_for, array_map( function ( $p ) { return $p->ID; }, $group ) );
				$max_idx = array_search( max( $counts ), $counts );
				$keep = $group[ $max_idx ];
				$remove = null;
				foreach ( $group as $p ) { if ( $p->ID !== $keep->ID ) { $remove = $p; break; } }
				if ( $remove ) {
					WP_CLI::log( sprintf( '    → wp tpj merge-photographers --keep=%s --remove=%s%s',
						$keep->post_name, $remove->post_name,
						count( $group ) > 2 ? ' (then merge the rest in turn)' : '' ) );
				}
			}
			WP_CLI::log( '' );
		}

		if ( ! empty( $substring_pairs ) ) {
			WP_CLI::log( sprintf( '== SUBSTRING — %d pair%s ==',
				count( $substring_pairs ), count( $substring_pairs ) === 1 ? '' : 's' ) );
			foreach ( $substring_pairs as $pair ) {
				WP_CLI::log( '' );
				$print_record( $pair[0] );
				$print_record( $pair[1] );
				$print_pair_command( $pair );
			}
			WP_CLI::log( '' );
		}

		if ( ! empty( $fuzzy_pairs ) ) {
			WP_CLI::log( sprintf( '== FUZZY (edit distance ≤ 2) — %d pair%s ==',
				count( $fuzzy_pairs ), count( $fuzzy_pairs ) === 1 ? '' : 's' ) );
			foreach ( $fuzzy_pairs as $triple ) {
				WP_CLI::log( '' );
				$print_record( $triple[0] );
				$print_record( $triple[1] );
				WP_CLI::log( sprintf( '    distance=%d', $triple[2] ) );
				$print_pair_command( [ $triple[0], $triple[1] ] );
			}
		}
	}

	/**
	 * Re-align every essay / interview / feature's `tpj_photographer`
	 * link list with the photographer names resolved for that article.
	 * Multi-author credits ("X & Y") produce one link row per name in
	 * collaboration order. This is the cleanup pass for archives where
	 * the original migration heuristics (parsing the legacy bio block,
	 * first-tag fallback) produced incorrect or topic-named Photographer
	 * records.
	 *
	 * Behavior:
	 *  - Article has no resolvable name: existing links are kept only
	 *    if every linked record's title looks like a personal name;
	 *    otherwise all links are removed.
	 *  - Article has names and the current links exactly match (same
	 *    set of slugs): keep, no writes.
	 *  - Article has names and the current links differ: rewrite the
	 *    link list to match, creating any missing CPTs.
	 *
	 * Use --force to overwrite even when the current links already
	 * match — useful after slug-rule changes.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview without writing.
	 *
	 * [--force]
	 * : Re-link every article regardless of whether current links match.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj relink-photographers --dry-run
	 *   wp tpj relink-photographers
	 *   wp tpj relink-photographers --force
	 */
	public static function relink_photographers( $args, $assoc_args ) {
		$dry_run = ! empty( $assoc_args['dry-run'] );
		$force   = ! empty( $assoc_args['force'] );

		$relinked        = 0;
		$unchanged       = 0;
		$unlinked        = 0;
		$created         = 0;
		$skipped_no_name = 0;

		foreach ( [ 'essay', 'interview', 'feature' ] as $post_type ) {
			$query = new WP_Query( [
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
			] );

			WP_CLI::log( sprintf( 'Walking %d %s posts.', count( $query->posts ), $post_type ) );

			foreach ( $query->posts as $post_id ) {
				$resolved_names = tpj_resolve_photographer_names( $post_id );
				$current_ids    = tpj_get_photographer_links( $post_id );
				$current_posts  = array_filter( array_map( 'get_post', $current_ids ) );

				if ( empty( $resolved_names ) ) {
					if ( ! empty( $current_posts ) ) {
						// Preserve the existing links only when EVERY linked
						// record's title looks like a real personal name.
						// Records titled with topic words ("Abstract") stay
						// detached so the orphan trash command can clean them.
						$all_personal = true;
						foreach ( $current_posts as $cp ) {
							if ( ! tpj_looks_like_personal_name( $cp->post_title ) ) {
								$all_personal = false;
								break;
							}
						}
						if ( $all_personal ) {
							$unchanged++;
						} else {
							if ( ! $dry_run ) {
								tpj_clear_photographer_links( $post_id );
							}
							$unlinked++;
						}
					} else {
						$skipped_no_name++;
					}
					continue;
				}

				// Build the desired list: one CPT per resolved name, in
				// collaboration order. Track which would be new vs reused.
				$desired_ids        = [];
				$desired_titles     = [];
				$new_records_in_run = 0;
				$invalid_name       = false;

				foreach ( $resolved_names as $name ) {
					$slug = sanitize_title( $name );
					if ( $slug === '' ) {
						$invalid_name = true;
						break;
					}
					$existing = get_page_by_path( $slug, OBJECT, 'photographer' );
					if ( $existing && $existing->post_type === 'photographer' && $existing->post_status === 'publish' ) {
						$desired_ids[]    = (int) $existing->ID;
						$desired_titles[] = $existing->post_title;
						continue;
					}
					if ( $dry_run ) {
						$desired_ids[]    = 0; // sentinel — would be created
						$desired_titles[] = $name . ' [new]';
						$new_records_in_run++;
						continue;
					}
					$new_id = wp_insert_post( [
						'post_type'   => 'photographer',
						'post_status' => 'publish',
						'post_title'  => $name,
						'post_name'   => $slug,
					], true );
					if ( is_wp_error( $new_id ) || $new_id === 0 ) {
						WP_CLI::warning( sprintf( 'Failed to create photographer "%s" for %s #%d.', $name, $post_type, $post_id ) );
						$invalid_name = true;
						break;
					}
					$desired_ids[]    = (int) $new_id;
					$desired_titles[] = $name;
					$new_records_in_run++;
				}

				if ( $invalid_name || empty( $desired_ids ) ) {
					$skipped_no_name++;
					continue;
				}

				// Match check: same set of CPT IDs in the same order? In
				// dry-run, missing CPTs use the 0 sentinel which can never
				// match an existing link, so the run shows them as a relink.
				if ( ! $force && $current_ids === $desired_ids ) {
					$unchanged++;
					continue;
				}

				if ( $dry_run ) {
					$current_titles = array_map( function ( $cp ) { return $cp->post_title; }, $current_posts );
					WP_CLI::log( sprintf(
						'[dry] %s #%d → [%s] (was %s)',
						$post_type, $post_id,
						implode( ' & ', $desired_titles ),
						! empty( $current_titles ) ? '"' . implode( ' & ', $current_titles ) . '"' : 'unlinked'
					) );
					$created  += $new_records_in_run;
					$relinked++;
					continue;
				}

				tpj_set_photographer_links( $post_id, $desired_ids );
				$created  += $new_records_in_run;
				$relinked++;
			}
		}

		$summary = sprintf(
			'Relinked %d. Unchanged %d. Unlinked %d (name removed). New records %d. No-name skipped %d.',
			$relinked, $unchanged, $unlinked, $created, $skipped_no_name
		);

		if ( $dry_run ) {
			WP_CLI::success( '[dry run] ' . $summary );
		} else {
			WP_CLI::success( $summary );
		}
	}

	/**
	 * Trash (or permanently delete) Photographer CPT records that have
	 * zero linked articles. Run after relink-photographers to clean up
	 * topic-named records ("Abstract", "Black and White") whose
	 * articles have all been redirected.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview without writing.
	 *
	 * [--delete]
	 * : Permanently delete instead of trashing. Trash is recoverable;
	 *   delete is not.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj trash-orphan-photographers --dry-run
	 *   wp tpj trash-orphan-photographers
	 *   wp tpj trash-orphan-photographers --delete
	 */
	public static function trash_orphan_photographers( $args, $assoc_args ) {
		$dry_run = ! empty( $assoc_args['dry-run'] );
		$force_delete = ! empty( $assoc_args['delete'] );

		$query = new WP_Query( [
			'post_type'      => 'photographer',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'no_found_rows'  => true,
		] );

		$kept = 0;
		$processed = 0;

		WP_CLI::log( sprintf( 'Checking %d photographer records.', count( $query->posts ) ) );

		foreach ( $query->posts as $photog ) {
			$linked = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'publish',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $photog->ID,
				'fields'         => 'ids',
				'posts_per_page' => 1,
				'no_found_rows'  => false,
			] );

			if ( $linked->found_posts > 0 ) {
				$kept++;
				continue;
			}

			if ( $dry_run ) {
				WP_CLI::log( sprintf(
					'[dry] would %s "%s" (#%d, slug=%s) — 0 linked articles',
					$force_delete ? 'delete' : 'trash',
					$photog->post_title, $photog->ID, $photog->post_name
				) );
			} else {
				if ( $force_delete ) {
					wp_delete_post( $photog->ID, true );
				} else {
					wp_trash_post( $photog->ID );
				}
			}
			$processed++;
		}

		$summary = sprintf(
			'%d orphan%s %s. %d records kept (have linked articles).',
			$processed,
			$processed === 1 ? '' : 's',
			$force_delete ? 'permanently deleted' : 'trashed',
			$kept
		);

		if ( $dry_run ) {
			WP_CLI::success( '[dry run] ' . $summary );
		} else {
			WP_CLI::success( $summary );
		}
	}

	/**
	 * Look up a photographer by slug derived from name. Create one if
	 * none exists. Returns [ 'id' => int, 'created' => bool ] or null
	 * on failure. In dry-run mode, returns a stubbed result without
	 * writing.
	 */
	private static function find_or_create_photographer( $name, $dry_run ) {
		$slug = sanitize_title( $name );
		if ( $slug === '' ) {
			return null;
		}
		$existing = get_page_by_path( $slug, OBJECT, 'photographer' );
		if ( $existing && $existing->post_type === 'photographer' ) {
			return [ 'id' => (int) $existing->ID, 'created' => false ];
		}
		if ( $dry_run ) {
			return [ 'id' => 0, 'created' => true ];
		}
		$new_id = wp_insert_post( [
			'post_type'   => 'photographer',
			'post_status' => 'publish',
			'post_title'  => $name,
			'post_name'   => $slug,
		], true );
		if ( is_wp_error( $new_id ) || $new_id === 0 ) {
			return null;
		}
		return [ 'id' => (int) $new_id, 'created' => true ];
	}

	/**
	 * Merge two photographer records into one. Reassigns every linked
	 * article on the duplicate to the keeper, fills any missing fields
	 * on the keeper from the duplicate, and trashes the duplicate.
	 *
	 * Idempotent in the sense that re-running with the same args after
	 * the first merge will report "no linked articles" and leave state
	 * unchanged (the duplicate is already in the trash).
	 *
	 * ## OPTIONS
	 *
	 * --keep=<slug>
	 * : Slug of the photographer record to keep (the canonical one).
	 *
	 * --remove=<slug>
	 * : Slug of the duplicate to merge in and trash.
	 *
	 * [--dry-run]
	 * : Print the plan without writing changes.
	 *
	 * [--delete]
	 * : Permanently delete the duplicate instead of trashing it.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj merge-photographers --keep=hana-mendel --remove=hana-elie-mendel --dry-run
	 *   wp tpj merge-photographers --keep=hana-mendel --remove=hana-elie-mendel
	 */
	public static function merge_photographers( $args, $assoc_args ) {
		$keep_slug   = isset( $assoc_args['keep'] )   ? (string) $assoc_args['keep']   : '';
		$remove_slug = isset( $assoc_args['remove'] ) ? (string) $assoc_args['remove'] : '';
		$dry_run     = ! empty( $assoc_args['dry-run'] );
		$force_delete = ! empty( $assoc_args['delete'] );

		if ( $keep_slug === '' || $remove_slug === '' ) {
			WP_CLI::error( 'Both --keep=<slug> and --remove=<slug> are required.' );
		}
		if ( $keep_slug === $remove_slug ) {
			WP_CLI::error( '--keep and --remove must be different.' );
		}

		$keep   = get_page_by_path( $keep_slug, OBJECT, 'photographer' );
		$remove = get_page_by_path( $remove_slug, OBJECT, 'photographer' );

		if ( ! $keep ) {
			WP_CLI::error( sprintf( 'Photographer "%s" not found.', $keep_slug ) );
		}
		if ( ! $remove ) {
			WP_CLI::error( sprintf( 'Photographer "%s" not found.', $remove_slug ) );
		}

		WP_CLI::log( sprintf(
			'Merging "%s" (#%d, slug=%s) → "%s" (#%d, slug=%s)%s',
			$remove->post_title, $remove->ID, $remove->post_name,
			$keep->post_title, $keep->ID, $keep->post_name,
			$dry_run ? ' [dry run]' : ''
		) );

		// 1. Reassign every linked article from the duplicate to the keeper.
		$linked_q = new WP_Query( [
			'post_type'      => [ 'essay', 'interview', 'feature' ],
			'post_status'    => 'any',
			'meta_key'       => 'tpj_photographer',
			'meta_value'     => (string) $remove->ID,
			'fields'         => 'ids',
			'posts_per_page' => -1,
			'no_found_rows'  => false,
		] );

		$linked_ids = $linked_q->posts;
		WP_CLI::log( sprintf( 'Linked articles to reassign: %d', count( $linked_ids ) ) );

		if ( ! $dry_run ) {
			foreach ( $linked_ids as $linked_id ) {
				// Multi-author safe: swap only the duplicate's ID,
				// preserve other co-credits, and dedupe in case the
				// article already credits the keeper too.
				$current = tpj_get_photographer_links( $linked_id );
				$updated = [];
				foreach ( $current as $id ) {
					$updated[] = ( (int) $id === (int) $remove->ID ) ? (int) $keep->ID : (int) $id;
				}
				tpj_set_photographer_links( $linked_id, $updated );
			}
		}

		// 2. Fill any missing meta on the keeper from the duplicate.
		$meta_keys = [
			'website', 'instagram', 'twitter', 'facebook', 'tumblr', 'flickr',
			'vsco_grid', 'vimeo', 'blog',
			'bluesky', 'threads', 'linkedin',
			'tpj_portrait_url', 'tpj_location', 'tpj_email',
		];
		$copied = [];
		foreach ( $meta_keys as $key ) {
			$keep_value   = get_post_meta( $keep->ID,   $key, true );
			$remove_value = get_post_meta( $remove->ID, $key, true );
			if ( ( $keep_value === '' || $keep_value === null ) && $remove_value !== '' && $remove_value !== null ) {
				if ( ! $dry_run ) {
					update_post_meta( $keep->ID, $key, $remove_value );
				}
				$copied[] = $key;
			}
		}
		if ( $copied ) {
			WP_CLI::log( 'Filled missing fields on keeper from duplicate: ' . implode( ', ', $copied ) );
		} else {
			WP_CLI::log( 'No missing fields to fill from duplicate.' );
		}

		// 3. Featured Image: copy if keeper has none.
		$keep_thumb   = (int) get_post_thumbnail_id( $keep->ID );
		$remove_thumb = (int) get_post_thumbnail_id( $remove->ID );
		if ( ! $keep_thumb && $remove_thumb ) {
			if ( ! $dry_run ) {
				set_post_thumbnail( $keep->ID, $remove_thumb );
			}
			WP_CLI::log( sprintf( 'Copied Featured Image (attachment #%d) from duplicate.', $remove_thumb ) );
		}

		// 4. Trash or delete the duplicate.
		if ( ! $dry_run ) {
			if ( $force_delete ) {
				wp_delete_post( $remove->ID, true );
				WP_CLI::log( sprintf( 'Permanently deleted duplicate (#%d).', $remove->ID ) );
			} else {
				wp_trash_post( $remove->ID );
				WP_CLI::log( sprintf( 'Trashed duplicate (#%d). Restorable from Trash.', $remove->ID ) );
			}
		}

		if ( $dry_run ) {
			WP_CLI::success( sprintf( 'Dry run complete. Would reassign %d articles and trash duplicate.', count( $linked_ids ) ) );
		} else {
			WP_CLI::success( sprintf( 'Merged. Reassigned %d articles. Duplicate %s.',
				count( $linked_ids ),
				$force_delete ? 'permanently deleted' : 'trashed'
			) );
		}
	}

	/**
	 * Apply an attribution-audit CSV back to the database. Pairs with
	 * `wp tpj export-attribution-audit`, which produces the CSV editors
	 * fill in.
	 *
	 * The CSV must include the columns post_id, photographer_meta,
	 * linked_photographer, and flag. Per row:
	 *
	 *   - photographer_meta filled  → canonical credit. Writes that
	 *     value to the article's `photographer` post meta and rebuilds
	 *     its `tpj_photographer` link list (one row per name, splitting
	 *     on &/and/comma). Creates Photographer CPTs that don't exist.
	 *
	 *   - photographer_meta empty + flag=mismatch  → editor has
	 *     endorsed the existing link. Writes the linked CPT's title
	 *     into `photographer` post meta so the resolver agrees with the
	 *     link, preventing a future relink-photographers run from
	 *     clobbering it. The link itself isn't touched.
	 *
	 *   - any other empty-meta row  → no-op. The audit flagged it but
	 *     the editor left no override.
	 *
	 * Idempotent: re-running over the same CSV produces no new writes
	 * once the data is in shape.
	 *
	 * ## OPTIONS
	 *
	 * --csv=<path>
	 * : Path to the audit CSV. Headers required.
	 *
	 * [--dry-run]
	 * : Print every planned action without writing.
	 *
	 * [--limit=<n>]
	 * : Process only the first N data rows. Useful for spot checks.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj apply-attribution-audit --csv=audit.csv --dry-run
	 *   wp tpj apply-attribution-audit --csv=audit.csv --limit=5 --dry-run
	 *   wp tpj apply-attribution-audit --csv=audit.csv
	 */
	public static function apply_attribution_audit( $args, $assoc_args ) {
		$csv_path = isset( $assoc_args['csv'] ) ? (string) $assoc_args['csv'] : '';
		$dry_run  = ! empty( $assoc_args['dry-run'] );
		$limit    = isset( $assoc_args['limit'] ) ? (int) $assoc_args['limit'] : 0;

		if ( $csv_path === '' || ! is_readable( $csv_path ) ) {
			WP_CLI::error( '--csv=<path> is required and must be readable.' );
		}

		$fh = fopen( $csv_path, 'r' );
		if ( ! $fh ) {
			WP_CLI::error( sprintf( 'Could not open CSV: %s', $csv_path ) );
		}
		$headers = fgetcsv( $fh );
		if ( ! is_array( $headers ) ) {
			fclose( $fh );
			WP_CLI::error( 'CSV has no header row.' );
		}
		$idx = array_flip( $headers );
		foreach ( [ 'post_id', 'photographer_meta', 'linked_photographer', 'flag' ] as $req ) {
			if ( ! isset( $idx[ $req ] ) ) {
				fclose( $fh );
				WP_CLI::error( sprintf( 'Missing required column: %s', $req ) );
			}
		}

		$applied_credit  = 0; // photographer_meta written + links rebuilt
		$synced_postmeta = 0; // empty-meta + mismatch fix-ups
		$skipped         = 0;
		$created_total   = 0;
		$missing_post    = 0;
		$processed       = 0;

		while ( ( $row = fgetcsv( $fh ) ) !== false ) {
			if ( $limit > 0 && $processed >= $limit ) {
				break;
			}
			$processed++;

			$post_id = (int) ( $row[ $idx['post_id'] ] ?? 0 );
			$meta    = trim( (string) ( $row[ $idx['photographer_meta'] ] ?? '' ) );
			$linked  = trim( (string) ( $row[ $idx['linked_photographer'] ] ?? '' ) );
			$flag    = trim( (string) ( $row[ $idx['flag'] ] ?? '' ) );

			$post = $post_id > 0 ? get_post( $post_id ) : null;
			if ( ! $post || ! in_array( $post->post_type, [ 'essay', 'interview', 'feature' ], true ) ) {
				WP_CLI::warning( sprintf( 'Row %d: post #%d not found or wrong type — skipping.', $processed, $post_id ) );
				$missing_post++;
				continue;
			}

			if ( $meta !== '' ) {
				// Canonical override. Normalize the join string and rebuild
				// the link list to match.
				$names      = tpj_split_photographer_names( $meta );
				$normalized = tpj_join_photographer_names( $names );
				if ( $normalized === '' ) {
					WP_CLI::warning( sprintf( 'Row %d (#%d): photographer_meta did not parse — skipping.', $processed, $post_id ) );
					$skipped++;
					continue;
				}

				$desired_ids    = [];
				$desired_titles = [];
				$created_here   = 0;
				$abort          = false;

				foreach ( $names as $name ) {
					$slug = sanitize_title( $name );
					if ( $slug === '' ) {
						$abort = true;
						break;
					}
					$existing = get_page_by_path( $slug, OBJECT, 'photographer' );
					if ( $existing && $existing->post_type === 'photographer' && $existing->post_status === 'publish' ) {
						$desired_ids[]    = (int) $existing->ID;
						$desired_titles[] = sprintf( '%s (#%d)', $existing->post_title, $existing->ID );
						continue;
					}
					if ( $dry_run ) {
						$desired_ids[]    = 0;
						$desired_titles[] = $name . ' [new]';
						$created_here++;
						continue;
					}
					$new_id = wp_insert_post( [
						'post_type'   => 'photographer',
						'post_status' => 'publish',
						'post_title'  => $name,
						'post_name'   => $slug,
					], true );
					if ( is_wp_error( $new_id ) || $new_id === 0 ) {
						WP_CLI::warning( sprintf( 'Row %d (#%d): failed to create photographer "%s".', $processed, $post_id, $name ) );
						$abort = true;
						break;
					}
					$desired_ids[]    = (int) $new_id;
					$desired_titles[] = sprintf( '%s (#%d) [new]', $name, $new_id );
					$created_here++;
				}

				if ( $abort || empty( $desired_ids ) ) {
					$skipped++;
					continue;
				}

				$current_ids = tpj_get_photographer_links( $post_id );
				$is_change   = ( $current_ids !== $desired_ids );

				if ( $dry_run ) {
					WP_CLI::log( sprintf(
						'[dry] credit  #%-6d %-40s  meta="%s"  links=%s%s',
						$post_id,
						tpj_short_title( $post ),
						$normalized,
						implode( ' & ', $desired_titles ),
						$is_change ? '' : ' [no change]'
					) );
				} else {
					update_post_meta( $post_id, 'photographer', $normalized );
					tpj_set_photographer_links( $post_id, $desired_ids );
				}
				$applied_credit++;
				$created_total += $created_here;
				continue;
			}

			// Empty meta. Only act when the audit flagged a mismatch and
			// the article currently has a valid linked photographer — that
			// pairing means "editor reviewed and endorsed the link".
			if ( $flag === 'mismatch' && $linked !== '' ) {
				$current_ids   = tpj_get_photographer_links( $post_id );
				$current_posts = array_filter( array_map( 'get_post', $current_ids ) );
				if ( empty( $current_posts ) ) {
					WP_CLI::warning( sprintf( 'Row %d (#%d): mismatch row but no live link to sync from — skipping.', $processed, $post_id ) );
					$skipped++;
					continue;
				}
				$linked_titles = array_map( function ( $p ) { return $p->post_title; }, $current_posts );
				$normalized    = tpj_join_photographer_names( $linked_titles );
				$existing_meta = (string) get_post_meta( $post_id, 'photographer', true );
				if ( strcasecmp( trim( $existing_meta ), trim( $normalized ) ) === 0 ) {
					$skipped++;
					continue;
				}
				if ( $dry_run ) {
					WP_CLI::log( sprintf(
						'[dry] sync    #%-6d %-40s  meta="%s"  (was "%s")',
						$post_id,
						tpj_short_title( $post ),
						$normalized,
						$existing_meta
					) );
				} else {
					update_post_meta( $post_id, 'photographer', $normalized );
				}
				$synced_postmeta++;
				continue;
			}

			$skipped++;
		}
		fclose( $fh );

		$summary = sprintf(
			'Credited %d. Synced postmeta %d. Created %d. Skipped %d. Missing posts %d. Total rows %d.',
			$applied_credit, $synced_postmeta, $created_total, $skipped, $missing_post, $processed
		);

		if ( $dry_run ) {
			WP_CLI::success( '[dry run] ' . $summary );
		} else {
			WP_CLI::success( $summary );
		}
	}

	/**
	 * Split legacy "combo" photographer CPTs — single records titled
	 * with multiple names ("Annika White & Carl Knight",
	 * "Anais &amp; Dax") — into one CPT per name and rewrite linked
	 * articles to point at every individual collaborator.
	 *
	 * Background: pre-multi-author migrations stored joint credits as a
	 * single Photographer record. Now that articles can hold multiple
	 * `tpj_photographer` rows, a collaboration like "Moments Before
	 * Checkout" should link to two separate photographer records — one
	 * per person — so each gets a profile page.
	 *
	 * For each combo CPT this command:
	 *   1. Splits the title on &/and/comma (entities decoded).
	 *   2. Finds or creates a Photographer CPT for each name.
	 *   3. Walks every article linked to the combo CPT and rewrites
	 *      its link list, replacing the combo ID with the list of
	 *      individual IDs. Other co-credits on the article are kept.
	 *   4. Writes the joined name string back to each article's
	 *      `photographer` postmeta so the resolver agrees.
	 *
	 * The combo CPT itself is left in place — once nothing links to it,
	 * `wp tpj trash-orphan-photographers` will clean it up. Bios and
	 * social links on the combo are not migrated automatically; they
	 * usually describe both collaborators and need editorial judgement.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview the plan without writing.
	 *
	 * [--limit=<n>]
	 * : Process only the first N combo CPTs.
	 *
	 * ## EXAMPLES
	 *
	 *   wp tpj split-combo-photographers --dry-run
	 *   wp tpj split-combo-photographers
	 */
	public static function split_combo_photographers( $args, $assoc_args ) {
		$dry_run = ! empty( $assoc_args['dry-run'] );
		$limit   = isset( $assoc_args['limit'] ) ? (int) $assoc_args['limit'] : 0;

		$query = new WP_Query( [
			'post_type'      => 'photographer',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'no_found_rows'  => true,
		] );

		$combos = [];
		foreach ( $query->posts as $p ) {
			$names = tpj_split_photographer_names( (string) $p->post_title );
			if ( count( $names ) >= 2 ) {
				$combos[] = [ 'post' => $p, 'names' => $names ];
			}
		}

		if ( empty( $combos ) ) {
			WP_CLI::success( 'No combo photographer records found.' );
			return;
		}

		WP_CLI::log( sprintf( 'Found %d combo photographer record%s.', count( $combos ), count( $combos ) === 1 ? '' : 's' ) );

		$processed       = 0;
		$articles_total  = 0;
		$created_total   = 0;
		$reused_total    = 0;

		foreach ( $combos as $combo ) {
			if ( $limit > 0 && $processed >= $limit ) {
				break;
			}
			$processed++;

			$combo_post  = $combo['post'];
			$combo_names = $combo['names'];
			$joined      = tpj_join_photographer_names( $combo_names );

			// Resolve / create individual CPTs.
			$individual_ids    = [];
			$individual_titles = [];
			$abort             = false;
			$created_here      = 0;

			foreach ( $combo_names as $name ) {
				$slug = sanitize_title( $name );
				if ( $slug === '' ) {
					$abort = true;
					break;
				}
				$existing = get_page_by_path( $slug, OBJECT, 'photographer' );
				if ( $existing && $existing->post_type === 'photographer' && $existing->post_status === 'publish' && (int) $existing->ID !== (int) $combo_post->ID ) {
					$individual_ids[]    = (int) $existing->ID;
					$individual_titles[] = sprintf( '%s (#%d)', $existing->post_title, $existing->ID );
					$reused_total++;
					continue;
				}
				if ( $dry_run ) {
					$individual_ids[]    = 0;
					$individual_titles[] = $name . ' [new]';
					$created_here++;
					continue;
				}
				$new_id = wp_insert_post( [
					'post_type'   => 'photographer',
					'post_status' => 'publish',
					'post_title'  => $name,
					'post_name'   => $slug,
				], true );
				if ( is_wp_error( $new_id ) || $new_id === 0 ) {
					WP_CLI::warning( sprintf( 'Failed to create individual photographer "%s" while splitting #%d.', $name, $combo_post->ID ) );
					$abort = true;
					break;
				}
				$individual_ids[]    = (int) $new_id;
				$individual_titles[] = sprintf( '%s (#%d) [new]', $name, $new_id );
				$created_here++;
			}

			if ( $abort || empty( $individual_ids ) ) {
				WP_CLI::warning( sprintf( 'Skipping combo #%d ("%s") — could not resolve all names.', $combo_post->ID, $combo_post->post_title ) );
				continue;
			}

			// Find every article currently linked to the combo CPT.
			$linked_q = new WP_Query( [
				'post_type'      => [ 'essay', 'interview', 'feature' ],
				'post_status'    => 'any',
				'meta_key'       => 'tpj_photographer',
				'meta_value'     => (string) $combo_post->ID,
				'fields'         => 'ids',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
			] );
			$article_ids = $linked_q->posts;

			WP_CLI::log( sprintf(
				'%s combo #%d "%s" → [%s] across %d article%s',
				$dry_run ? '[dry]' : '     ',
				$combo_post->ID, $combo_post->post_title,
				implode( ' & ', $individual_titles ),
				count( $article_ids ), count( $article_ids ) === 1 ? '' : 's'
			) );

			foreach ( $article_ids as $article_id ) {
				$current = tpj_get_photographer_links( $article_id );

				// Rebuild the link list: replace combo ID with the
				// individual IDs (preserving order), drop the combo,
				// dedupe.
				$rebuilt = [];
				foreach ( $current as $id ) {
					if ( (int) $id === (int) $combo_post->ID ) {
						foreach ( $individual_ids as $ind ) {
							if ( $ind > 0 ) $rebuilt[] = $ind;
						}
					} else {
						$rebuilt[] = (int) $id;
					}
				}

				if ( ! $dry_run ) {
					tpj_set_photographer_links( $article_id, $rebuilt );
					update_post_meta( $article_id, 'photographer', $joined );
				}
				$articles_total++;
			}

			$created_total += $created_here;
		}

		$summary = sprintf(
			'Split %d combo record%s. Rewrote %d article link list%s. Created %d individual record%s. Reused %d existing.',
			$processed, $processed === 1 ? '' : 's',
			$articles_total, $articles_total === 1 ? '' : 's',
			$created_total, $created_total === 1 ? '' : 's',
			$reused_total
		);

		if ( $dry_run ) {
			WP_CLI::success( '[dry run] ' . $summary );
		} else {
			WP_CLI::success( $summary . ' Run `wp tpj trash-orphan-photographers` to clean up the now-empty combo records.' );
		}
	}

	/**
	 * Apply Instagram-handle backfills from a CSV produced by the
	 * frontend audit script. Each row pairs a photographer slug with an
	 * Instagram handle inferred from the photographer blob at the bottom
	 * of their articles. Idempotent — photographers who already have a
	 * non-empty `instagram` meta are skipped unless --overwrite is set.
	 *
	 * Required CSV columns:
	 *   slug          — photographer post_name
	 *   proposed_ig   — handle (URL or @handle accepted; stored as bare handle)
	 *
	 * Optional columns:
	 *   confidence    — HIGH | MEDIUM | LOW. Used with --min-confidence.
	 *   approve       — y / yes / 1 / true to mark a row as editor-approved.
	 *                   When this column exists, only approved rows apply.
	 *
	 * ## OPTIONS
	 *
	 * --csv=<path>
	 * : Path to the review CSV.
	 *
	 * [--min-confidence=<tier>]
	 * : Skip rows below this tier (HIGH | MEDIUM | LOW). Default: HIGH.
	 *   Ignored when the CSV has no `confidence` column.
	 *
	 * [--overwrite]
	 * : Update photographers who already have an `instagram` meta value.
	 *   Off by default — backfill is non-destructive.
	 *
	 * [--limit=<n>]
	 * : Stop after touching N photographer records. 0 = no limit.
	 *
	 * [--dry-run]
	 * : Print what would change without writing.
	 *
	 * ## EXAMPLES
	 *
	 *   # Preview HIGH-confidence rows only.
	 *   wp tpj apply-photographer-instagram --csv=/path/to/review.csv --dry-run
	 *
	 *   # Apply HIGH and MEDIUM rows the editor approved.
	 *   wp tpj apply-photographer-instagram --csv=/path/to/review.csv --min-confidence=MEDIUM
	 *
	 * @when after_wp_load
	 */
	public static function apply_photographer_instagram( $args, $assoc_args ) {
		$csv_path  = isset( $assoc_args['csv'] ) ? (string) $assoc_args['csv'] : '';
		$dry_run   = ! empty( $assoc_args['dry-run'] );
		$overwrite = ! empty( $assoc_args['overwrite'] );
		$limit     = isset( $assoc_args['limit'] ) ? (int) $assoc_args['limit'] : 0;
		$min_conf  = strtoupper(
			isset( $assoc_args['min-confidence'] )
				? (string) $assoc_args['min-confidence']
				: 'HIGH'
		);

		$tier_rank = [ 'HIGH' => 3, 'MEDIUM' => 2, 'LOW' => 1 ];
		if ( ! isset( $tier_rank[ $min_conf ] ) ) {
			WP_CLI::error( '--min-confidence must be HIGH, MEDIUM, or LOW.' );
		}
		$min_rank = $tier_rank[ $min_conf ];

		if ( $csv_path === '' || ! is_readable( $csv_path ) ) {
			WP_CLI::error( '--csv=<path> is required and must be readable.' );
		}

		$fh = fopen( $csv_path, 'r' );
		if ( ! $fh ) {
			WP_CLI::error( sprintf( 'Could not open CSV: %s', $csv_path ) );
		}
		$headers = fgetcsv( $fh );
		if ( ! is_array( $headers ) ) {
			fclose( $fh );
			WP_CLI::error( 'CSV has no header row.' );
		}
		$idx = array_flip(
			array_map( 'strtolower', array_map( 'trim', $headers ) )
		);
		foreach ( [ 'slug', 'proposed_ig' ] as $req ) {
			if ( ! isset( $idx[ $req ] ) ) {
				fclose( $fh );
				WP_CLI::error( sprintf( 'Missing required column: %s', $req ) );
			}
		}
		$has_approve_col    = isset( $idx['approve'] );
		$has_confidence_col = isset( $idx['confidence'] );

		$applied            = 0;
		$would_apply        = 0;
		$skipped_unapproved = 0;
		$skipped_low_conf   = 0;
		$skipped_existing   = 0;
		$skipped_invalid    = 0;
		$missing_photog     = 0;
		$processed          = 0;

		while ( ( $row = fgetcsv( $fh ) ) !== false ) {
			if ( $limit > 0 && ( $applied + $would_apply ) >= $limit ) {
				break;
			}
			$processed++;

			$slug       = trim( (string) ( $row[ $idx['slug'] ] ?? '' ) );
			$handle_raw = trim( (string) ( $row[ $idx['proposed_ig'] ] ?? '' ) );
			$approve    = $has_approve_col
				? strtolower( trim( (string) ( $row[ $idx['approve'] ] ?? '' ) ) )
				: '';
			$confidence = $has_confidence_col
				? strtoupper( trim( (string) ( $row[ $idx['confidence'] ] ?? '' ) ) )
				: '';

			if ( $slug === '' || $handle_raw === '' ) {
				WP_CLI::warning( sprintf(
					'Row %d: empty slug or proposed_ig — skipping.', $processed
				) );
				$skipped_invalid++;
				continue;
			}

			if ( $has_approve_col ) {
				$approved = in_array(
					$approve, [ 'y', 'yes', '1', 'true' ], true
				);
				if ( ! $approved ) {
					$skipped_unapproved++;
					continue;
				}
			}

			if ( $has_confidence_col && $confidence !== '' ) {
				$rank = $tier_rank[ $confidence ] ?? 0;
				if ( $rank < $min_rank ) {
					$skipped_low_conf++;
					continue;
				}
			}

			$handle = tpj_normalize_ig_handle( $handle_raw );
			if ( $handle === null ) {
				WP_CLI::warning( sprintf(
					'Row %d (%s): unparseable IG value "%s" — skipping.',
					$processed, $slug, $handle_raw
				) );
				$skipped_invalid++;
				continue;
			}

			$photog = get_page_by_path( $slug, OBJECT, 'photographer' );
			if ( ! $photog || $photog->post_type !== 'photographer' ) {
				WP_CLI::warning( sprintf(
					'Row %d: photographer slug "%s" not found — skipping.',
					$processed, $slug
				) );
				$missing_photog++;
				continue;
			}

			$existing = trim(
				(string) get_post_meta( $photog->ID, 'instagram', true )
			);
			if ( $existing !== '' && ! $overwrite ) {
				$skipped_existing++;
				continue;
			}
			$existing_norm = $existing !== ''
				? tpj_normalize_ig_handle( $existing )
				: null;
			if ( $existing_norm === $handle ) {
				$skipped_existing++;
				continue;
			}

			$conf_tag = $confidence !== '' ? sprintf( ' [%s]', $confidence ) : '';

			if ( $dry_run ) {
				$prefix = $existing === ''
					? '→'
					: sprintf( '@%s →', $existing_norm );
				WP_CLI::log( sprintf(
					'[dry] %-40s %s @%s%s',
					tpj_short_title( $photog ), $prefix, $handle, $conf_tag
				) );
				$would_apply++;
			} else {
				update_post_meta( $photog->ID, 'instagram', $handle );
				WP_CLI::log( sprintf(
					'set @%s for %s%s',
					$handle, tpj_short_title( $photog ), $conf_tag
				) );
				$applied++;
			}
		}
		fclose( $fh );

		WP_CLI::log( '' );
		WP_CLI::log( sprintf( 'Processed:                %d rows', $processed ) );
		if ( $dry_run ) {
			WP_CLI::log( sprintf( 'Would apply:              %d', $would_apply ) );
		} else {
			WP_CLI::log( sprintf( 'Applied:                  %d', $applied ) );
		}
		if ( $skipped_unapproved ) {
			WP_CLI::log( sprintf( 'Skipped (unapproved):     %d', $skipped_unapproved ) );
		}
		if ( $skipped_low_conf ) {
			WP_CLI::log( sprintf( 'Skipped (below %s):     %d', $min_conf, $skipped_low_conf ) );
		}
		if ( $skipped_existing ) {
			WP_CLI::log( sprintf(
				'Skipped (already had IG): %d%s',
				$skipped_existing,
				$overwrite ? '' : ' — use --overwrite to replace'
			) );
		}
		if ( $skipped_invalid ) {
			WP_CLI::log( sprintf( 'Skipped (invalid):        %d', $skipped_invalid ) );
		}
		if ( $missing_photog ) {
			WP_CLI::log( sprintf( 'Missing photographer:     %d', $missing_photog ) );
		}

		if ( $dry_run ) {
			WP_CLI::success( sprintf(
				'[dry run] Would update %d photographer%s. Re-run without --dry-run to apply.',
				$would_apply, $would_apply === 1 ? '' : 's'
			) );
		} else {
			WP_CLI::success( sprintf(
				'Updated %d photographer%s.',
				$applied, $applied === 1 ? '' : 's'
			) );
		}
	}

	/**
	 * Import newly-published v1 content from a side database while
	 * preserving the local photographer architecture. Handles ID
	 * collisions by renumbering the incoming rows.
	 *
	 * Workflow:
	 *  1. Load the new mysqldump into a side database (e.g. wp_tpj_compare).
	 *  2. Run `wp tpj import-delta --from-db=wp_tpj_compare` (dry-run by
	 *     default) to preview which essays/attachments/postmeta/
	 *     term_relationships would be inserted and how IDs get rewritten.
	 *  3. When the plan looks right, re-run with --apply to write.
	 *
	 * What it imports:
	 *  - Essays / interviews / features published in the side DB whose
	 *    ID is missing from the current DB, OR present with a non-publish
	 *    status (i.e. drafts that have since gone live).
	 *  - Their attachments (post_parent = the essay ID).
	 *  - Their postmeta and term_relationships.
	 *  - Revisions only if --include-revisions is passed.
	 *
	 * ID rewrite rules:
	 *  - If an incoming ID does NOT exist locally, keep it as-is.
	 *  - If the incoming ID collides with a local row (typically a
	 *    photographer CPT whose auto-increment ID landed in v1's
	 *    keyspace), allocate a fresh ID = MAX(local.ID) + N.
	 *  - For essays already present locally as drafts (the publish-flip
	 *    case), update the existing row in place — no new ID.
	 *  - Rewrites propagate through: post_parent on attachments,
	 *    _thumbnail_id postmeta, header_image postmeta, and any
	 *    term_relationships.object_id pointing into the rewritten set.
	 *
	 * After --apply, the photographer pipeline still needs to run to
	 * extract credits from the imported bodies. Suggested follow-up:
	 *   wp tpj migrate-photographer-blocks --only=<new-ids>
	 *   wp tpj migrate-photographers --only=<new-ids>
	 *   wp tpj relink-photographers --dry-run
	 *
	 * ## OPTIONS
	 *
	 * [--from-db=<db>]
	 * : Name of the pre-loaded side database. Default: wp_tpj_compare.
	 *
	 * [--apply]
	 * : Write the import. Without this flag, prints the plan only.
	 *
	 * [--include-revisions]
	 * : Also import wp_posts rows with post_type=revision. Off by default —
	 * revisions inflate the import without changing the rendered article.
	 *
	 * @when after_wp_load
	 */
	public function import_delta( $args, $assoc_args ) {
		global $wpdb;

		$from_db           = $assoc_args['from-db'] ?? 'wp_tpj_compare';
		$apply             = isset( $assoc_args['apply'] );
		$include_revisions = isset( $assoc_args['include-revisions'] );

		$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW DATABASES LIKE %s', $from_db ) );
		if ( ! $exists ) {
			WP_CLI::error( "Side database `$from_db` not found. Load the new dump into a side DB first (see the workflow comment in this command)." );
		}

		$side_posts = "`$from_db`.wp_posts";
		$check      = $wpdb->get_var( "SELECT COUNT(*) FROM $side_posts" );
		if ( $check === null ) {
			WP_CLI::error( "Side DB `$from_db` exists but has no wp_posts table." );
		}
		WP_CLI::log( "Side DB `$from_db` loaded ($check rows in wp_posts)." );

		// 1. Find essays/interviews/features to import: rows in side that
		// are missing locally, or whose status differs (draft → publish).
		$diffs = $wpdb->get_results( "
			SELECT n.ID, n.post_type, n.post_status AS new_status, n.post_date, n.post_title,
				   c.ID AS local_id, c.post_status AS local_status
			FROM $side_posts n
			LEFT JOIN {$wpdb->posts} c ON c.ID = n.ID AND c.post_type = n.post_type
			WHERE n.post_type IN ('essay','interview','feature')
			  AND n.post_status = 'publish'
			  AND (c.ID IS NULL OR c.post_status != n.post_status)
		" );
		if ( empty( $diffs ) ) {
			WP_CLI::success( 'No new essays/interviews/features to import.' );
			return;
		}

		$new_essay_ids = array_map( fn( $r ) => (int) $r->ID, $diffs );

		// 2. Collect dependent rows: attachments + (optionally) revisions.
		$dep_types = $include_revisions ? "('attachment','revision')" : "('attachment')";
		$dep_in    = implode( ',', array_map( 'intval', $new_essay_ids ) );
		$deps      = $wpdb->get_results( "
			SELECT ID, post_type, post_status, post_parent, post_mime_type
			FROM $side_posts
			WHERE post_parent IN ($dep_in) AND post_type IN $dep_types
		" );

		// 3. Combine to full import set, then check for ID collisions.
		$all_ids = $new_essay_ids;
		foreach ( $deps as $d ) {
			$all_ids[] = (int) $d->ID;
		}
		$all_ids     = array_unique( $all_ids );
		$ids_in      = implode( ',', array_map( 'intval', $all_ids ) );
		$colliders   = $wpdb->get_results( "
			SELECT ID, post_type, post_title FROM {$wpdb->posts} WHERE ID IN ($ids_in)
		" );
		$collide_map = [];
		foreach ( $colliders as $c ) {
			$collide_map[ (int) $c->ID ] = $c;
		}

		// 4. Build the ID rewrite map. Publish-flip rows (essay already
		// exists locally) update in place — they aren't collisions in
		// the conflict sense, they're intentional updates.
		$publish_flip_ids = [];
		foreach ( $diffs as $row ) {
			if ( $row->local_id !== null ) {
				$publish_flip_ids[ (int) $row->ID ] = true;
			}
		}

		$max_local_id = (int) $wpdb->get_var( "SELECT MAX(ID) FROM {$wpdb->posts}" );
		$next_id      = $max_local_id + 1;
		$rewrite_map  = [];
		foreach ( $all_ids as $id ) {
			if ( isset( $publish_flip_ids[ $id ] ) ) {
				continue;
			}
			if ( isset( $collide_map[ $id ] ) ) {
				$rewrite_map[ $id ] = $next_id++;
			}
		}

		// 5. Emit the plan.
		WP_CLI::log( '' );
		WP_CLI::log( '======= IMPORT-DELTA PLAN =======' );
		WP_CLI::log( sprintf( 'Mode:           %s', $apply ? 'APPLY (will write)' : 'DRY-RUN (no writes)' ) );
		WP_CLI::log( sprintf( 'Side DB:        %s', $from_db ) );
		WP_CLI::log( sprintf( 'Local max ID:   %d', $max_local_id ) );
		WP_CLI::log( sprintf( 'New ID range:   %d..%d', $max_local_id + 1, $next_id - 1 ) );
		WP_CLI::log( sprintf( 'Essays/etc:     %d', count( $diffs ) ) );
		WP_CLI::log( sprintf( 'Dependents:     %d (%s)', count( $deps ), $include_revisions ? 'attachments + revisions' : 'attachments only' ) );
		WP_CLI::log( sprintf( 'Collisions:     %d (renumbered to fresh IDs)', count( $rewrite_map ) ) );
		WP_CLI::log( sprintf( 'Publish-flips:  %d (update in place)', count( $publish_flip_ids ) ) );
		WP_CLI::log( '' );

		WP_CLI::log( '--- Essays / interviews / features ---' );
		foreach ( $diffs as $row ) {
			$target_id = $rewrite_map[ $row->ID ] ?? $row->ID;
			if ( isset( $publish_flip_ids[ (int) $row->ID ] ) ) {
				$action = sprintf( 'UPDATE in place (status %s → %s)', $row->local_status, $row->new_status );
			} elseif ( isset( $rewrite_map[ $row->ID ] ) ) {
				$action = sprintf( 'INSERT new (collision: ID %d held by %s "%s")',
					$row->ID,
					$collide_map[ (int) $row->ID ]->post_type,
					$collide_map[ (int) $row->ID ]->post_title
				);
			} else {
				$action = 'INSERT new';
			}
			WP_CLI::log( sprintf( '  %s %5d → %5d  %s', $row->post_type, $row->ID, $target_id, $row->post_title ) );
			WP_CLI::log( sprintf( '    %s', $action ) );
		}

		if ( $deps ) {
			WP_CLI::log( '' );
			WP_CLI::log( '--- Attachments' . ( $include_revisions ? ' / revisions' : '' ) . ' ---' );
			foreach ( $deps as $d ) {
				$old_id  = (int) $d->ID;
				$new_id  = $rewrite_map[ $old_id ] ?? $old_id;
				$old_par = (int) $d->post_parent;
				$new_par = $rewrite_map[ $old_par ] ?? $old_par;
				$collide = isset( $collide_map[ $old_id ] ) ? sprintf( '  [COLLIDES with local %s "%s"]',
					$collide_map[ $old_id ]->post_type,
					$collide_map[ $old_id ]->post_title
				) : '';
				WP_CLI::log( sprintf( '  %-10s %5d → %5d  parent %5d → %5d  %s%s',
					$d->post_type, $old_id, $new_id, $old_par, $new_par, $d->post_mime_type, $collide
				) );
			}
		}

		$pm_in      = implode( ',', array_map( 'intval', $all_ids ) );
		$postmeta_n = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `$from_db`.wp_postmeta WHERE post_id IN ($pm_in)" );

		$post_id_typed_keys = [ '_thumbnail_id', 'header_image' ];
		$key_in_sql         = "'" . implode( "','", $post_id_typed_keys ) . "'";
		$ref_rows           = $wpdb->get_results( "
			SELECT post_id, meta_key, meta_value
			FROM `$from_db`.wp_postmeta
			WHERE post_id IN ($pm_in) AND meta_key IN ($key_in_sql) AND meta_value REGEXP '^[0-9]+$'
		" );

		WP_CLI::log( '' );
		WP_CLI::log( '--- Postmeta ---' );
		WP_CLI::log( sprintf( '  %d total postmeta rows to copy.', $postmeta_n ) );
		WP_CLI::log( sprintf( '  %d rows with post-id-typed values to rewrite (_thumbnail_id, header_image):', count( $ref_rows ) ) );
		foreach ( $ref_rows as $r ) {
			$old_post = (int) $r->post_id;
			$new_post = $rewrite_map[ $old_post ] ?? $old_post;
			$old_val  = (int) $r->meta_value;
			$new_val  = $rewrite_map[ $old_val ] ?? $old_val;
			$flag     = ( $new_val !== $old_val ) ? '  REWRITE' : '';
			WP_CLI::log( sprintf( '    post %d→%d  %s: %d→%d%s',
				$old_post, $new_post, $r->meta_key, $old_val, $new_val, $flag
			) );
		}

		$tr_rows = $wpdb->get_results( "
			SELECT tr.object_id, tr.term_taxonomy_id, tt.taxonomy
			FROM `$from_db`.wp_term_relationships tr
			LEFT JOIN `$from_db`.wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
			WHERE tr.object_id IN ($pm_in)
		" );
		WP_CLI::log( '' );
		WP_CLI::log( '--- Term relationships ---' );
		WP_CLI::log( sprintf( '  %d rows to copy.', count( $tr_rows ) ) );
		$tax_summary = [];
		foreach ( $tr_rows as $r ) {
			$tax                 = $r->taxonomy ?? 'unknown';
			$tax_summary[ $tax ] = ( $tax_summary[ $tax ] ?? 0 ) + 1;
		}
		foreach ( $tax_summary as $tax => $n ) {
			WP_CLI::log( sprintf( '    %s: %d', $tax, $n ) );
		}

		WP_CLI::log( '' );
		if ( ! $apply ) {
			WP_CLI::success( 'Dry-run complete. Re-run with --apply to write.' );
			return;
		}

		// === APPLY PATH ===
		// One transaction wraps every write so a mid-import failure
		// can ROLLBACK and leave the local DB untouched. Order:
		// 1) wp_posts (updates first for publish-flips, then inserts),
		// 2) wp_postmeta (with ID-typed value rewrites),
		// 3) wp_terms + wp_term_taxonomy (only if a referenced term
		//    doesn't already exist locally),
		// 4) wp_term_relationships.
		$wpdb->query( 'START TRANSACTION' );

		try {
			$inserted_posts = [];
			$updated_posts  = [];

			// --- 1a. Posts: updates in place for publish-flip rows.
			foreach ( $diffs as $row ) {
				if ( ! isset( $publish_flip_ids[ (int) $row->ID ] ) ) {
					continue;
				}
				$full = $wpdb->get_row( $wpdb->prepare(
					"SELECT * FROM `$from_db`.wp_posts WHERE ID = %d",
					(int) $row->ID
				), ARRAY_A );
				if ( ! $full ) {
					throw new \RuntimeException( "Publish-flip source row missing for ID {$row->ID}" );
				}
				unset( $full['ID'] );
				// Rewrite post_parent if it points into our rewrite map
				// (rare for an essay but handle it for symmetry).
				if ( isset( $rewrite_map[ (int) $full['post_parent'] ] ) ) {
					$full['post_parent'] = $rewrite_map[ (int) $full['post_parent'] ];
				}
				$ok = $wpdb->update( $wpdb->posts, $full, [ 'ID' => (int) $row->ID ] );
				if ( $ok === false ) {
					throw new \RuntimeException( "UPDATE wp_posts failed for ID {$row->ID}: {$wpdb->last_error}" );
				}
				$updated_posts[] = (int) $row->ID;
			}

			// --- 1b. Posts: inserts (essays + attachments + optional revisions).
			$insert_post_ids = $new_essay_ids;
			foreach ( $deps as $d ) {
				$insert_post_ids[] = (int) $d->ID;
			}
			$insert_post_ids = array_values( array_diff(
				array_unique( $insert_post_ids ),
				array_keys( $publish_flip_ids )
			) );

			foreach ( $insert_post_ids as $old_id ) {
				$full = $wpdb->get_row( $wpdb->prepare(
					"SELECT * FROM `$from_db`.wp_posts WHERE ID = %d",
					$old_id
				), ARRAY_A );
				if ( ! $full ) {
					throw new \RuntimeException( "Source row missing for ID $old_id" );
				}
				$new_id = $rewrite_map[ $old_id ] ?? $old_id;
				$full['ID'] = $new_id;
				if ( isset( $rewrite_map[ (int) $full['post_parent'] ] ) ) {
					$full['post_parent'] = $rewrite_map[ (int) $full['post_parent'] ];
				}
				$ok = $wpdb->insert( $wpdb->posts, $full );
				if ( $ok === false ) {
					throw new \RuntimeException( "INSERT wp_posts failed for $old_id→$new_id: {$wpdb->last_error}" );
				}
				$inserted_posts[ $old_id ] = $new_id;
			}

			// --- 2. Postmeta: copy all rows for every imported post,
			//        rewriting post_id and (for known keys) meta_value.
			$post_id_typed_keys_set = array_flip( $post_id_typed_keys );
			$postmeta_inserted      = 0;

			foreach ( $all_ids as $old_id ) {
				$new_id = $rewrite_map[ $old_id ] ?? $old_id;

				// For publish-flips we delete existing local postmeta
				// first so we cleanly replace whatever WP put there
				// while the post was a draft. Skipping this would
				// duplicate _edit_lock, _edit_last, etc.
				if ( isset( $publish_flip_ids[ $old_id ] ) ) {
					$wpdb->delete( $wpdb->postmeta, [ 'post_id' => $new_id ] );
				}

				$rows = $wpdb->get_results( $wpdb->prepare(
					"SELECT meta_key, meta_value FROM `$from_db`.wp_postmeta WHERE post_id = %d",
					$old_id
				), ARRAY_A );
				foreach ( $rows as $r ) {
					$key = $r['meta_key'];
					$val = $r['meta_value'];
					if ( isset( $post_id_typed_keys_set[ $key ] ) && ctype_digit( (string) $val ) ) {
						$as_int = (int) $val;
						if ( isset( $rewrite_map[ $as_int ] ) ) {
							$val = (string) $rewrite_map[ $as_int ];
						}
					}
					$ok = $wpdb->insert( $wpdb->postmeta, [
						'post_id'    => $new_id,
						'meta_key'   => $key,
						'meta_value' => $val,
					] );
					if ( $ok === false ) {
						throw new \RuntimeException( "INSERT wp_postmeta failed for post $old_id→$new_id key $key: {$wpdb->last_error}" );
					}
					$postmeta_inserted++;
				}
			}

			// --- 3. Terms + term_taxonomy: only insert if not present
			//        locally. The term_relationships step needs a valid
			//        term_taxonomy_id to point at.
			$tr_full = $wpdb->get_results( "
				SELECT tr.object_id, tr.term_taxonomy_id, tr.term_order,
					   tt.term_id, tt.taxonomy, tt.description, tt.parent
				FROM `$from_db`.wp_term_relationships tr
				JOIN `$from_db`.wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
				WHERE tr.object_id IN ($pm_in)
			" );

			$tt_id_map     = [];
			$terms_added   = [];
			foreach ( $tr_full as $r ) {
				$src_tt = (int) $r->term_taxonomy_id;
				if ( isset( $tt_id_map[ $src_tt ] ) ) {
					continue;
				}
				// Does the SAME term_taxonomy_id already exist locally
				// pointing at the SAME term + taxonomy? If so, reuse.
				$local_tt = $wpdb->get_var( $wpdb->prepare(
					"SELECT term_taxonomy_id FROM {$wpdb->term_taxonomy}
					 WHERE term_taxonomy_id = %d AND term_id = %d AND taxonomy = %s",
					$src_tt, (int) $r->term_id, $r->taxonomy
				) );
				if ( $local_tt ) {
					$tt_id_map[ $src_tt ] = (int) $local_tt;
					continue;
				}
				// Same term + taxonomy combo under a different tt_id locally?
				$local_tt2 = $wpdb->get_var( $wpdb->prepare(
					"SELECT term_taxonomy_id FROM {$wpdb->term_taxonomy}
					 WHERE term_id = %d AND taxonomy = %s",
					(int) $r->term_id, $r->taxonomy
				) );
				if ( $local_tt2 ) {
					$tt_id_map[ $src_tt ] = (int) $local_tt2;
					continue;
				}

				// Need to create. First ensure wp_terms row exists.
				$term_id = (int) $r->term_id;
				$has_term = $wpdb->get_var( $wpdb->prepare(
					"SELECT term_id FROM {$wpdb->terms} WHERE term_id = %d",
					$term_id
				) );
				if ( ! $has_term ) {
					$src_term = $wpdb->get_row( $wpdb->prepare(
						"SELECT * FROM `$from_db`.wp_terms WHERE term_id = %d",
						$term_id
					), ARRAY_A );
					if ( ! $src_term ) {
						throw new \RuntimeException( "Source wp_terms row missing for term_id $term_id" );
					}
					$ok = $wpdb->insert( $wpdb->terms, $src_term );
					if ( $ok === false ) {
						throw new \RuntimeException( "INSERT wp_terms failed for term_id $term_id: {$wpdb->last_error}" );
					}
					$terms_added[] = $term_id;
				}

				// Insert term_taxonomy. Let MySQL auto-allocate term_taxonomy_id
				// because the source ID may collide locally.
				$ok = $wpdb->insert( $wpdb->term_taxonomy, [
					'term_id'     => $term_id,
					'taxonomy'    => $r->taxonomy,
					'description' => (string) $r->description,
					'parent'      => (int) $r->parent,
					'count'       => 0,
				] );
				if ( $ok === false ) {
					throw new \RuntimeException( "INSERT wp_term_taxonomy failed for term_id $term_id taxonomy {$r->taxonomy}: {$wpdb->last_error}" );
				}
				$tt_id_map[ $src_tt ] = (int) $wpdb->insert_id;
			}

			// --- 4. Term relationships.
			$tr_inserted = 0;
			foreach ( $tr_full as $r ) {
				$obj_old = (int) $r->object_id;
				$obj_new = $rewrite_map[ $obj_old ] ?? $obj_old;
				$tt_new  = $tt_id_map[ (int) $r->term_taxonomy_id ];

				if ( isset( $publish_flip_ids[ $obj_old ] ) ) {
					// Clear any prior tag links on the publish-flip row
					// so we don't accumulate duplicates from the draft state.
					$wpdb->delete( $wpdb->term_relationships, [
						'object_id'        => $obj_new,
						'term_taxonomy_id' => $tt_new,
					] );
				}

				$ok = $wpdb->insert( $wpdb->term_relationships, [
					'object_id'        => $obj_new,
					'term_taxonomy_id' => $tt_new,
					'term_order'       => (int) $r->term_order,
				] );
				if ( $ok === false ) {
					throw new \RuntimeException( "INSERT wp_term_relationships failed for object $obj_old→$obj_new tt $tt_new: {$wpdb->last_error}" );
				}
				$tr_inserted++;
			}

			// Recount on touched taxonomies so the term count reflects reality.
			$tt_touched = array_unique( array_values( $tt_id_map ) );
			if ( $tt_touched ) {
				wp_update_term_count_now( $tt_touched, 'post_tag' );
			}

			$wpdb->query( 'COMMIT' );
		} catch ( \Throwable $e ) {
			$wpdb->query( 'ROLLBACK' );
			WP_CLI::error( 'Import failed and was rolled back: ' . $e->getMessage() );
		}

		// === Summary + follow-up ===
		WP_CLI::log( '' );
		WP_CLI::log( '======= IMPORT-DELTA RESULT =======' );
		WP_CLI::log( sprintf( 'Updated posts:   %d', count( $updated_posts ) ) );
		WP_CLI::log( sprintf( 'Inserted posts:  %d', count( $inserted_posts ) ) );
		WP_CLI::log( sprintf( 'Postmeta rows:   %d', $postmeta_inserted ) );
		WP_CLI::log( sprintf( 'Term rels:       %d', $tr_inserted ) );
		WP_CLI::log( sprintf( 'New terms:       %d', count( $terms_added ) ) );

		// Pull the new-essay IDs (post-rewrite) so the follow-up commands
		// reference them in their local form.
		$new_essay_local_ids = [];
		foreach ( $diffs as $row ) {
			$new_essay_local_ids[] = (int) ( $rewrite_map[ $row->ID ] ?? $row->ID );
		}
		$id_list = implode( ',', $new_essay_local_ids );

		WP_CLI::log( '' );
		WP_CLI::log( '--- Follow-up commands ---' );
		WP_CLI::log( "  wp tpj migrate-photographer-blocks --only=$id_list" );
		WP_CLI::log( "  wp tpj migrate-photographers --only=$id_list" );
		WP_CLI::log( "  wp tpj relink-photographers --dry-run" );

		// Surface attachment file paths that need to land on disk for
		// the post body / featured image to actually render.
		$attached_files = $wpdb->get_results( "
			SELECT post_id, meta_value AS path
			FROM {$wpdb->postmeta}
			WHERE meta_key = '_wp_attached_file' AND post_id IN ($id_list)
		" );
		if ( $attached_files ) {
			WP_CLI::log( '' );
			WP_CLI::log( '--- Featured-image files referenced by these essays ---' );
			foreach ( $attached_files as $f ) {
				WP_CLI::log( sprintf( '  wp-content/uploads/%s  (attachment %d)', $f->path, $f->post_id ) );
			}
		}
		// Also list every newly-inserted attachment's file so you know
		// the full set to rsync from production uploads.
		$ins_ids = array_values( $inserted_posts );
		if ( $ins_ids ) {
			$ins_in = implode( ',', array_map( 'intval', $ins_ids ) );
			$all_attached = $wpdb->get_results( "
				SELECT post_id, meta_value AS path
				FROM {$wpdb->postmeta}
				WHERE meta_key = '_wp_attached_file' AND post_id IN ($ins_in)
				ORDER BY post_id
			" );
			if ( $all_attached ) {
				WP_CLI::log( '' );
				WP_CLI::log( sprintf( '--- All %d attached files for new posts (rsync from production uploads) ---', count( $all_attached ) ) );
				foreach ( $all_attached as $f ) {
					WP_CLI::log( sprintf( '  wp-content/uploads/%s', $f->path ) );
				}
			}
		}

		WP_CLI::success( 'Import complete.' );
	}
}

/**
 * Tight title formatter for CLI dry-run lines: trims to ~38 chars and
 * pads, so the per-row output columns line up across articles.
 */
function tpj_short_title( $post ) {
	$t = (string) $post->post_title;
	if ( mb_strlen( $t ) > 38 ) {
		$t = mb_substr( $t, 0, 37 ) . '…';
	}
	return $t;
}

/**
 * Best-effort parser for the photographer block at the end of an article.
 *
 * Editorial conventions changed over the archive's 13-year span, so this
 * walks several fallbacks in priority order. Returns null only when no
 * photographer name can be recovered from any source.
 *
 * Strategies (first match wins for the name):
 *   1. <strong>Name</strong> inside the first paragraph after the
 *      <div class="circletar"></div> marker (2017–2024 convention)
 *   2. Heuristic match for "[Name] is/was/has..." in the first paragraph
 *      (newer essays where editors stopped bolding the name)
 *   3. Heuristic match for "[Name]'s work/photography/images/..."
 *   4. The post's `photographer` meta value (rare on essays, common on
 *      interviews)
 *   5. The post's first non-generic tag
 *
 * Bio and portrait are only populated when the marker is present. For
 * essays without the marker (pre-2017), we still link the photographer
 * by name only — useful for Photographer Profile aggregation even though
 * the article-end card has nothing structured to display.
 *
 * @return array|null { name, bio, portrait_url, blob } or null
 */
function tpj_parse_photographer_blob( $post ) {
	$content = (string) $post->post_content;
	$marker  = '<div class="circletar"></div>';
	$pos     = stripos( $content, $marker );

	$paragraphs   = [];
	$bio_html     = '';
	$blob         = '';
	$portrait_url = null;
	$first_p_text = '';

	if ( $pos !== false ) {
		$after = substr( $content, $pos + strlen( $marker ) );
		$blob  = $marker . $after;

		if ( preg_match_all( '/<p[^>]*>(.*?)<\/p>/is', $after, $matches ) ) {
			$paragraphs = array_filter(
				array_map( 'trim', $matches[1] ),
				function ( $p ) {
					$stripped = trim( wp_strip_all_tags( $p ) );
					return $stripped !== '' && $stripped !== '&nbsp;';
				}
			);
			$paragraphs = array_values( $paragraphs );
		}

		// Build bio from all paragraphs after the marker.
		foreach ( $paragraphs as $p ) {
			$clean = wp_kses( $p, [
				'strong' => [],
				'b'      => [],
				'em'     => [],
				'i'      => [],
				'a'      => [ 'href' => [], 'target' => [], 'rel' => [] ],
				'br'     => [],
			] );
			$clean = trim( $clean );
			if ( $clean !== '' ) {
				$bio_html .= '<p>' . $clean . '</p>' . "\n";
			}
		}

		if ( ! empty( $paragraphs ) ) {
			$first_p_text = trim( wp_strip_all_tags( $paragraphs[0] ) );
		}

		// Portrait URL lives in the per-post custom_css meta as a background-image.
		$css = (string) get_post_meta( $post->ID, 'custom_css', true );
		if ( preg_match( '/background\s*:\s*url\s*\(\s*([^)]+?)\s*\)/i', $css, $m_url ) ) {
			$portrait_url = trim( $m_url[1], "'\" \t\r\n" );
		}
	}

	$name = tpj_extract_photographer_name( $post, $paragraphs, $first_p_text );
	if ( ! $name ) {
		return null;
	}

	return [
		'name'         => $name,
		'bio'          => trim( $bio_html ),
		'portrait_url' => $portrait_url,
		'blob'         => $blob,
	];
}

/**
 * Cascading name extraction. Returns null if no candidate is found.
 * Every return value is run through the same validation (normalize +
 * looks-like-name) so the blocklist applies uniformly to all strategies.
 */
function tpj_extract_photographer_name( $post, $paragraphs, $first_p_text ) {
	$post_slug = $post->post_name;
	$accept = function ( $candidate ) use ( $post_slug ) {
		if ( ! is_string( $candidate ) ) return null;
		$normalized = tpj_normalize_name_candidate( $candidate );
		if ( $normalized === '' ) return null;
		if ( ! tpj_looks_like_name( $normalized ) ) return null;
		// Reject when the candidate is just the essay's own title (a tag
		// mirroring the title gets pulled in otherwise).
		if ( $post_slug && sanitize_title( $normalized ) === $post_slug ) return null;
		return $normalized;
	};

	// 1. <strong> in the first paragraph after the marker
	if ( ! empty( $paragraphs ) ) {
		if ( preg_match( '/<strong[^>]*>(.+?)<\/strong>/is', $paragraphs[0], $m ) ) {
			$candidate = trim( wp_strip_all_tags( $m[1] ) );
			$candidate = rtrim( $candidate, " \t.,:;" );
			if ( ( $name = $accept( $candidate ) ) ) return $name;
		}
	}

	// 2. "[Name] is/was/has..." at start of first paragraph
	if ( $first_p_text !== '' ) {
		if ( preg_match(
			'/^([A-Z][\p{L}\'\-]+(?:\s+[A-Z][\p{L}\'\-]+){0,2})\s+(?:is|was|has|works|lives|grew|started|began|photographs|makes|spent)\b/u',
			$first_p_text,
			$m
		) ) {
			if ( ( $name = $accept( $m[1] ) ) ) return $name;
		}

		// 3. "[Name]'s work/photography/images/lens..."
		if ( preg_match(
			'/\b([A-Z][\p{L}\'\-]+(?:\s+[A-Z][\p{L}\'\-]+){0,2})[\'\x{2019}]s\s+(?:work|photographs|photography|images|projects|practice|lens)\b/u',
			$first_p_text,
			$m
		) ) {
			if ( ( $name = $accept( $m[1] ) ) ) return $name;
		}
	}

	// 4. post_meta `photographer`
	$meta_name = get_post_meta( $post->ID, 'photographer', true );
	if ( is_string( $meta_name ) && trim( $meta_name ) !== '' ) {
		if ( ( $name = $accept( $meta_name ) ) ) return $name;
	}

	// 5. First post tag, skipping obvious non-name tags.
	$skip_tags = [
		'documentary', 'portrait', 'street', 'fashion', 'fine art',
		'still life', 'landscape', 'experimental', 'tpj spotlight',
		'celebrity', 'event', 'reviews', 'review',
	];
	$tags = wp_get_post_tags( $post->ID );
	foreach ( $tags as $tag ) {
		$lower = strtolower( $tag->name );
		if ( in_array( $lower, $skip_tags, true ) ) continue;
		if ( ( $name = $accept( $tag->name ) ) ) return $name;
	}

	return null;
}

/**
 * Strip leading credit prefixes from a `<strong>` payload so "Photography by
 * Aaron Feaver" becomes "Aaron Feaver". Returns an empty string when the
 * prefix marks a writer/reviewer rather than a photographer, or when the
 * payload is a place/community label the editor used as a header — caller
 * should fall through to other strategies in those cases.
 */
function tpj_normalize_name_candidate( $candidate ) {
	if ( $candidate === '' ) return '';

	// Decode HTML entities so "Annika White &amp; Carl Knight" comes through clean.
	$candidate = html_entity_decode( $candidate, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

	// Trim regular and non-breaking whitespace (the latter slips past trim()).
	$candidate = preg_replace( '/^[\s\x{00A0}]+|[\s\x{00A0}]+$/u', '', $candidate );

	if ( $candidate === '' ) return '';

	// Photographer credit prefixes: strip and keep the trailing name.
	$photog_prefixes = '/^(?:photographs?|photography|photos?|images?|pictures?)\s+by\s+/i';
	if ( preg_match( $photog_prefixes, $candidate ) ) {
		$candidate = trim( preg_replace( $photog_prefixes, '', $candidate ) );
		return $candidate;
	}

	// Writer / reviewer / interviewer credits: not the photographer.
	$writer_prefixes = '/^(?:reviewed|written|words|text|interview(?:ed)?|essay)\s+by\s+/i';
	if ( preg_match( $writer_prefixes, $candidate ) ) {
		return '';
	}

	// Editor sometimes opens with a place or group label in <strong> instead
	// of the photographer's name (e.g. "Los Angeles", "Black community").
	// Reject these so we fall through to tag/meta heuristics.
	$non_name_labels = [
		// Cities
		'los angeles', 'new york', 'new york city', 'nyc',
		'san francisco', 'chicago', 'london', 'paris', 'tokyo',
		'mexico city', 'havana', 'rome', 'berlin',
		// US states / regions
		'california', 'nevada', 'texas', 'arizona', 'oregon',
		'washington', 'colorado', 'florida', 'hawaii', 'montana',
		'american west', 'american south', 'american midwest',
		'middle east', 'pacific northwest', 'deep south',
		// Countries
		'philippines', 'mexico', 'cuba', 'brazil', 'japan',
		'india', 'china', 'iran', 'iraq', 'palestine',
		'ukraine', 'ireland', 'scotland', 'wales',
	];
	$lower = strtolower( $candidate );
	if ( in_array( $lower, $non_name_labels, true ) ) {
		return '';
	}
	// "[adjective] community" / "[adjective] people" type descriptors.
	if ( preg_match( '/^[\p{L}\s]+\s+(?:community|people|residents|neighborhood)$/iu', $candidate ) ) {
		return '';
	}

	return $candidate;
}

/**
 * Sanity check: does this string look like a person's name?
 * Allows letters, apostrophes, hyphens; rejects URLs, sentences, all-numerics,
 * and anything that doesn't have at least one capitalized word.
 */
function tpj_looks_like_name( $s ) {
	$s = trim( $s );
	if ( $s === '' ) return false;
	if ( strlen( $s ) > 60 ) return false;
	if ( preg_match( '/^https?:\/\//i', $s ) ) return false;
	if ( preg_match( '/^\d+$/', $s ) ) return false;

	$words = preg_split( '/\s+/', $s );
	if ( count( $words ) > 5 ) return false;

	// Names need at least one uppercase-led word. "artistic expression",
	// "fine art", and similar lowercase phrases shouldn't qualify.
	$has_upper = false;
	foreach ( $words as $w ) {
		if ( preg_match( '/^[\p{Lu}]/u', $w ) ) {
			$has_upper = true;
			break;
		}
	}
	if ( ! $has_upper ) return false;

	// Reject if the first word is lowercase (sentence-like, not a name).
	if ( ! preg_match( '/^[\p{Lu}]/u', $words[0] ) ) return false;

	return true;
}

/**
 * Find the first occurrence of $pattern in $text and return ~80 chars
 * of context around it (sentence-ish window).
 */
function tpj_extract_match_snippet( $text, $pattern ) {
	if ( ! preg_match( $pattern, $text, $m, PREG_OFFSET_CAPTURE ) ) {
		return '';
	}
	$pos = $m[0][1];
	$start = max( 0, $pos - 40 );
	$end = min( strlen( $text ), $pos + strlen( $m[0][0] ) + 40 );
	$snippet = substr( $text, $start, $end - $start );
	if ( $start > 0 ) $snippet = '…' . $snippet;
	if ( $end < strlen( $text ) ) $snippet .= '…';
	return preg_replace( '/\s+/', ' ', $snippet );
}

/**
 * Pulls <a> links out of bio HTML, returns the cleaned bio plus a map
 * of social/website meta keys to URLs.
 *
 * Returns: [ 'cleaned_html' => string, 'links' => [ key => url, ... ] ]
 */
function tpj_extract_links_from_bio( $html ) {
	$links = [];

	// First pass: capture every <a href="..."> in document order so the
	// first URL of each category wins.
	if ( preg_match_all( '/<a\s+[^>]*href=("|\')(.+?)\1[^>]*>(.*?)<\/a>/is', $html, $matches ) ) {
		foreach ( $matches[2] as $url ) {
			$normalized = tpj_normalize_url( $url );
			if ( ! $normalized ) continue;
			$key = tpj_categorize_url( $normalized );
			if ( ! isset( $links[ $key ] ) ) {
				$links[ $key ] = $normalized;
			}
		}
	}

	$cleaned = $html;
	$labels = '(?:website|web\s*site|site|web|instagram|ig|twitter|x|facebook|fb|tumblr|flickr|vsco(?:\s+grid)?|vimeo|blog|portfolio|bluesky|bsky|threads|linkedin)';

	// First pass: strip "Label: <a>...</a>" patterns where the label sits
	// outside the link (kills the orphan "Website:" that would otherwise
	// be left behind).
	$cleaned = preg_replace(
		'/(?:^|\s|>|\|)\s*' . $labels . '\s*[:\-—–]?\s*<a\s+[^>]*href=("|\')(?:.+?)\1[^>]*>.*?<\/a>/iu',
		'',
		$cleaned
	);

	// Second pass: replace each remaining <a> with either nothing
	// (if its text is empty or a category label) or its inner text
	// (so credits like <a>Melanie Cruz</a> survive as "Melanie Cruz").
	$cleaned = preg_replace_callback(
		'/<a\s+[^>]*href=("|\')(?:.+?)\1[^>]*>(.*?)<\/a>/is',
		function ( $m ) use ( $labels ) {
			$text = trim( wp_strip_all_tags( $m[2] ) );
			if ( $text === '' ) return '';
			if ( preg_match( '/^' . $labels . '\s*$/iu', $text ) ) return '';
			return $text;
		},
		$cleaned
	);

	// Anything left without href (rare): drop tag, keep meaningful text.
	$cleaned = preg_replace_callback(
		'/<a[^>]*>(.*?)<\/a>/is',
		function ( $m ) use ( $labels ) {
			$text = trim( wp_strip_all_tags( $m[1] ) );
			if ( $text === '' ) return '';
			if ( preg_match( '/^' . $labels . '\s*$/iu', $text ) ) return '';
			return $text;
		},
		$cleaned
	);

	// Strip orphan label words that lost their link earlier (e.g. trailing
	// "Website:" with nothing after it). Anchored to paragraph end / pipe
	// / line end so we don't gobble bio text.
	$cleaned = preg_replace(
		'/(?:^|\s|>|\|)\s*' . $labels . '\s*[:\-—–]\s*(?=<\/p>|<br|\s*[\|·]|\s*$)/iu',
		'',
		$cleaned
	);

	// Strip per-essay credit paragraphs that got pulled into the
	// photographer's bio during the v1 photographer-block migration.
	// These credit a specific essay's collaborators (model, stylist,
	// etc.) and don't belong on the photographer's standing bio.
	// Heuristic: short paragraph (<200 chars of plain text) that opens
	// with a known credit label.
	$credit_starts = '(?:created\s+in\s+partnership\s+with|in\s+collaboration\s+with|model\s+and\s+styling|models?|styling|stylist|hair\s+(?:and|&|&amp;)\s+(?:make[\s-]?up|makeup)|hair|make[\s-]?up|wardrobe|assistant|assisted\s+by|words(?:\s+by)?|art\s+direction|produced\s+by|production|special\s+thanks|thanks\s+to|subjects?|set\s+design(?:er)?|location|locations)';
	$cleaned = preg_replace_callback(
		'/<p[^>]*>([\s\S]*?)<\/p>/i',
		function ( $m ) use ( $credit_starts ) {
			$plain = trim( wp_strip_all_tags( $m[1] ) );
			if ( $plain === '' ) return '';
			if ( strlen( $plain ) > 200 ) return $m[0];

			// Known credit label list.
			if ( preg_match( '/^' . $credit_starts . '\b/iu', $plain ) ) {
				return '';
			}

			// Generic all-caps label heuristic — catches editor-specific
			// credit labels we haven't enumerated (COLLAGE ARTIST,
			// PHOTO ASSISTANT, GAFFER, etc.). Matches when the paragraph
			// starts with one or more uppercase words / acronyms followed
			// by a colon and a name. Mixed-case prose ("Julia Comita is…")
			// fails the second character test and stays put.
			if ( preg_match( '/^[A-Z][A-Z\s\/&\-]+\s*[:—–]\s*\S/u', $plain ) ) {
				return '';
			}

			return $m[0];
		},
		$cleaned
	);

	// Inline credit-block strip. When a paragraph contains "Label:" mid-text
	// (e.g. "...long bio prose. Model: Sarah Stylist: Greg Hair: Tom"), we
	// cut from the first credit label to the end of the paragraph. The
	// colon/dash is the discriminator — bare "stylist" in prose doesn't
	// match because there's no separator after it.
	$inline_credit_label = '(?:model[s]?|stylist|hair[\s-]?stylist|hairstylist|wardrobe[\s-]?stylist|wardrobe|hair|make[\s-]?up(?:\s+artist)?|makeup\s+artist|talent|gaffer|assistants?(?:\s+on\s+set)?|assisted\s+by|set\s+design(?:er)?|words(?:\s+by)?|production|produced\s+by|crew\s+credits?|team\s+credits?|collaborating\s+brands?|special\s+thanks|thanks\s+to|in\s+collaboration\s+with|created\s+in\s+partnership\s+with|art\s+direction|concept(?:\s*\/\s*model)?)';
	$inline_pattern = '/\b' . $inline_credit_label . '\s*[:—–]/iu';

	$cleaned = preg_replace_callback(
		'/<p[^>]*>([\s\S]*?)<\/p>/i',
		function ( $m ) use ( $inline_pattern ) {
			$inner = $m[1];
			if ( ! preg_match( $inline_pattern, $inner, $match, PREG_OFFSET_CAPTURE ) ) {
				return $m[0];
			}
			$offset = $match[0][1];
			$prefix = substr( $inner, 0, $offset );
			// Drop trailing whitespace and <br> tags so we don't leave
			// a dangling line break before the cut.
			$prefix = preg_replace( '/(?:\s|<br\s*\/?>)+$/i', '', $prefix );
			$plain_prefix = trim( wp_strip_all_tags( $prefix ) );
			if ( $plain_prefix === '' ) return '';
			return '<p>' . $prefix . '</p>';
		},
		$cleaned
	);

	// Strip orphan separators (|, ·, –) at the start/end of paragraphs
	// and collapse runs of whitespace.
	$cleaned = preg_replace( '/<p([^>]*)>\s*(?:[\|·\-–—,]\s*)+/i', '<p$1>', $cleaned );
	$cleaned = preg_replace( '/(?:\s*[\|·\-–—,])+\s*<\/p>/i', '</p>', $cleaned );

	// Drop empty paragraphs left behind.
	$cleaned = preg_replace( '/<p[^>]*>\s*(?:&nbsp;|\s)*<\/p>/i', '', $cleaned );

	// Tidy whitespace.
	$cleaned = preg_replace( '/[ \t]{2,}/', ' ', $cleaned );
	$cleaned = preg_replace( '/\n{3,}/', "\n\n", $cleaned );
	$cleaned = trim( $cleaned );

	return [
		'cleaned_html' => $cleaned,
		'links'        => $links,
	];
}

/**
 * Normalize an Instagram value to a bare handle. Accepts any of:
 *   https://www.instagram.com/handle/
 *   instagram.com/handle
 *   @handle
 *   handle
 * Returns null when the value can't yield a valid handle.
 */
function tpj_normalize_ig_handle( $value ) {
	$value = trim( (string) $value );
	if ( $value === '' ) return null;
	if ( preg_match(
		'#^(?:https?://)?(?:www\.)?(?:instagram\.com|instagr\.am)/([A-Za-z0-9._\-]+)/?#i',
		$value,
		$m
	) ) {
		$value = $m[1];
	} else {
		$value = ltrim( $value, '@' );
		$value = rtrim( $value, '/' );
	}
	if ( ! preg_match( '/^[A-Za-z0-9._\-]+$/', $value ) ) {
		return null;
	}
	if ( strlen( $value ) > 30 ) return null;
	return $value;
}

/**
 * Normalize a URL pulled from a v1 bio. Returns null if the value can't
 * sensibly be turned into an http(s) URL (mailto:, javascript:, etc.).
 */
function tpj_normalize_url( $url ) {
	$url = trim( html_entity_decode( $url, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
	if ( $url === '' ) return null;
	if ( stripos( $url, 'mailto:' ) === 0 ) return null;
	if ( stripos( $url, 'javascript:' ) === 0 ) return null;
	if ( $url[0] === '#' ) return null;

	if ( ! preg_match( '/^https?:\/\//i', $url ) ) {
		if ( strpos( $url, '//' ) === 0 ) {
			$url = 'https:' . $url;
		} elseif ( strpos( $url, '.' ) !== false ) {
			$url = 'https://' . ltrim( $url, '/' );
		} else {
			return null;
		}
	}

	$clean = esc_url_raw( $url );
	return $clean !== '' ? $clean : null;
}

/**
 * Map a URL host to one of the photographer meta keys.
 */
function tpj_categorize_url( $url ) {
	$host = parse_url( $url, PHP_URL_HOST );
	if ( ! is_string( $host ) || $host === '' ) return 'website';
	$host = strtolower( $host );

	if ( strpos( $host, 'instagram.com' ) !== false || strpos( $host, 'instagr.am' ) !== false ) return 'instagram';
	if ( strpos( $host, 'twitter.com' ) !== false || $host === 'x.com' || preg_match( '/(^|\.)x\.com$/', $host ) ) return 'twitter';
	if ( strpos( $host, 'facebook.com' ) !== false || strpos( $host, 'fb.com' ) !== false ) return 'facebook';
	if ( strpos( $host, 'tumblr.com' ) !== false ) return 'tumblr';
	if ( strpos( $host, 'flickr.com' ) !== false ) return 'flickr';
	if ( strpos( $host, 'vsco.co' ) !== false ) return 'vsco_grid';
	if ( strpos( $host, 'vimeo.com' ) !== false ) return 'vimeo';
	if ( strpos( $host, 'bsky.app' ) !== false || strpos( $host, 'bsky.social' ) !== false ) return 'bluesky';
	if ( strpos( $host, 'threads.net' ) !== false || strpos( $host, 'threads.com' ) !== false ) return 'threads';
	if ( strpos( $host, 'linkedin.com' ) !== false ) return 'linkedin';
	if (
		strpos( $host, 'blogspot.com' ) !== false ||
		strpos( $host, 'wordpress.com' ) !== false ||
		strpos( $host, 'medium.com' ) !== false ||
		strpos( $host, 'substack.com' ) !== false
	) return 'blog';

	return 'website';
}

WP_CLI::add_command( 'tpj migrate-photographers',         [ 'TPJ_CLI', 'migrate_photographers' ] );
WP_CLI::add_command( 'tpj migrate-photographer-blocks',   [ 'TPJ_CLI', 'migrate_photographer_blocks' ] );
WP_CLI::add_command( 'tpj clean-photographer-bios',       [ 'TPJ_CLI', 'clean_photographer_bios' ] );
WP_CLI::add_command( 'tpj audit-photographer-bios',       [ 'TPJ_CLI', 'audit_photographer_bios' ] );
WP_CLI::add_command( 'tpj merge-photographers',           [ 'TPJ_CLI', 'merge_photographers' ] );
WP_CLI::add_command( 'tpj backfill-phantom-photographers',[ 'TPJ_CLI', 'backfill_phantom_photographers' ] );
WP_CLI::add_command( 'tpj relink-photographers',          [ 'TPJ_CLI', 'relink_photographers' ] );
WP_CLI::add_command( 'tpj trash-orphan-photographers',    [ 'TPJ_CLI', 'trash_orphan_photographers' ] );
WP_CLI::add_command( 'tpj set-photographer',              [ 'TPJ_CLI', 'set_photographer' ] );
WP_CLI::add_command( 'tpj find-photographer-dupes',       [ 'TPJ_CLI', 'find_photographer_dupes' ] );
WP_CLI::add_command( 'tpj audit-photographers',           [ 'TPJ_CLI', 'audit_photographers' ] );
WP_CLI::add_command( 'tpj find-multi-photographer-articles', [ 'TPJ_CLI', 'find_multi_photographer_articles' ] );
WP_CLI::add_command( 'tpj find-uncredited-articles',      [ 'TPJ_CLI', 'find_uncredited_articles' ] );
WP_CLI::add_command( 'tpj export-attribution-audit',      [ 'TPJ_CLI', 'export_attribution_audit' ] );
WP_CLI::add_command( 'tpj apply-attribution-audit',       [ 'TPJ_CLI', 'apply_attribution_audit' ] );
WP_CLI::add_command( 'tpj split-combo-photographers',     [ 'TPJ_CLI', 'split_combo_photographers' ] );
WP_CLI::add_command( 'tpj apply-photographer-instagram',  [ 'TPJ_CLI', 'apply_photographer_instagram' ] );
WP_CLI::add_command( 'tpj seed-collections',              [ 'TPJ_CLI', 'seed_collections' ] );
WP_CLI::add_command( 'tpj import-delta',                  [ 'TPJ_CLI', 'import_delta' ] );
