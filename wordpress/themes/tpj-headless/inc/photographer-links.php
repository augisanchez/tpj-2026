<?php
/**
 * Multi-author-aware helpers for the article ↔ photographer relationship.
 *
 * The link is stored as one or more `tpj_photographer` post meta rows on
 * each essay/interview/feature, where each row's value is a Photographer
 * CPT post ID. Articles credited to a single photographer have one row;
 * collaborations have many.
 *
 * Single-row meta is intentional: WP_Query meta_value lookups
 * (`meta_key=tpj_photographer, meta_value=<photog_id>`) match an article
 * if ANY of its rows points at the photographer. That keeps the
 * "articles by this photographer" reverse query trivial for both single-
 * and multi-author cases. The cost is that callers MUST go through
 * tpj_set_photographer_links() / tpj_clear_photographer_links() so a
 * stray update_post_meta() doesn't collapse a multi-row link to one.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Replace the article's full photographer link list.
 *
 * Removes every existing `tpj_photographer` row on $post_id and writes
 * one row per id in $photographer_ids, in the given order. Empty array
 * clears the link entirely. Idempotent.
 */
function tpj_set_photographer_links( $post_id, array $photographer_ids ) {
	$post_id = (int) $post_id;
	if ( $post_id <= 0 ) {
		return;
	}

	// Normalize: ints, positive, deduped, order preserved.
	$seen = [];
	$ids  = [];
	foreach ( $photographer_ids as $raw ) {
		$id = (int) $raw;
		if ( $id <= 0 ) continue;
		if ( isset( $seen[ $id ] ) ) continue;
		$seen[ $id ] = true;
		$ids[]       = $id;
	}

	delete_post_meta( $post_id, 'tpj_photographer' );
	foreach ( $ids as $id ) {
		add_post_meta( $post_id, 'tpj_photographer', (string) $id, false );
	}
}

/**
 * Remove every photographer link on the article.
 */
function tpj_clear_photographer_links( $post_id ) {
	delete_post_meta( (int) $post_id, 'tpj_photographer' );
}

/**
 * Read every photographer ID linked to the article, in stored order.
 * Filters out IDs whose target post is missing, trashed, or not a
 * published photographer.
 */
function tpj_get_photographer_links( $post_id ) {
	$post_id = (int) $post_id;
	if ( $post_id <= 0 ) {
		return [];
	}
	$rows = get_post_meta( $post_id, 'tpj_photographer', false );
	if ( ! is_array( $rows ) || empty( $rows ) ) {
		return [];
	}
	$out = [];
	foreach ( $rows as $raw ) {
		$id = (int) $raw;
		if ( $id <= 0 ) continue;
		$p = get_post( $id );
		if ( ! $p || $p->post_type !== 'photographer' || $p->post_status !== 'publish' ) {
			continue;
		}
		$out[] = $id;
	}
	return $out;
}

/**
 * Convenience: the primary photographer ID is the first stored link,
 * or 0 if the article has none. Mirrors the legacy single-value read.
 */
function tpj_get_primary_photographer_id( $post_id ) {
	$ids = tpj_get_photographer_links( $post_id );
	return $ids ? $ids[0] : 0;
}

/**
 * Split a free-text photographer credit into one or more names, in the
 * order they appear. Handles the conjunctions editors use:
 *   "X & Y", "X and Y", "X, Y", "X; Y", "X & Y & Z".
 *
 * Whitespace is trimmed; empty fragments dropped. Names that contain
 * commas as part of their own punctuation (e.g. "Smith, Jr.") will be
 * incorrectly split — the editor convention is to use & or "and" for
 * collaborations, so commas are treated as separators.
 */
function tpj_split_photographer_names( $value ) {
	$value = trim( (string) $value );
	if ( $value === '' ) {
		return [];
	}
	// Decode HTML entities first: legacy CPT titles and postmeta picked
	// up `&amp;` from migration paths that double-encoded ampersands.
	// Without this, "Annika White &amp; Carl Knight" splits at `&` and
	// the second name becomes "amp; Carl Knight".
	$value = html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

	$split_pattern = '/\s*(?:&|,|;|\s+and\s+)\s*/i';

	// Atomic-combo early return: a Photographer CPT can flag itself as a
	// single duo / collective ("Anais & Dax"). If the credit resolves to
	// such a record by slug, return as one name. Gated on conjunction
	// presence so single-name credits skip the lookup.
	if ( preg_match( $split_pattern, $value ) ) {
		$slug = sanitize_title( $value );
		if ( $slug !== '' ) {
			$photog = get_page_by_path( $slug, OBJECT, 'photographer' );
			if ( $photog && get_post_meta( $photog->ID, 'tpj_atomic_combo', true ) ) {
				return [ $value ];
			}
		}
	}

	$parts = preg_split( $split_pattern, $value );
	$out   = [];
	foreach ( $parts as $p ) {
		$p = trim( (string) $p );
		if ( $p !== '' ) {
			$out[] = $p;
		}
	}
	return $out;
}

/**
 * Inverse of tpj_split_photographer_names. Joins with " & " — the
 * editorial convention used in the existing archive's photographer
 * blobs ("Annika White & Carl Knight").
 */
function tpj_join_photographer_names( array $names ) {
	$clean = [];
	foreach ( $names as $n ) {
		// Decode entities so a legacy CPT title with `&amp;` round-trips
		// to a clean credit string the resolver can split.
		$n = html_entity_decode( trim( (string) $n ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		if ( $n !== '' ) $clean[] = $n;
	}
	return implode( ' & ', $clean );
}
