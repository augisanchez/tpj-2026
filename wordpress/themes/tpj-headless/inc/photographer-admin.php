<?php
/**
 * Admin-side UI for the Photographer CPT that supports the editorial
 * picker workflow. Separate from photographer-meta.php so that file
 * stays focused on the editable meta-box fields and this file holds
 * read-only context panels and admin-only behavior.
 *
 * Current pieces:
 *  - Linked Articles meta box: shows every essay/interview/feature
 *    that links to this photographer via tpj_photographer postmeta,
 *    so editors can verify their link list at a glance.
 *
 * Planned (not yet built — see project_tpj_editorial_picker.md):
 *  - Slug-locked-after-publish guard.
 *  - Slug change disclosure UI.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'add_meta_boxes_photographer', function () {
	add_meta_box(
		'tpj_photographer_backlinks',
		'Linked Articles',
		'tpj_render_photographer_backlinks_meta_box',
		'photographer',
		'side',
		'default'
	);
} );

/**
 * Walks wp_postmeta for tpj_photographer rows whose meta_value matches
 * this photographer's post ID, joins back to wp_posts to recover the
 * article, and renders a compact list grouped by post_type. Multi-author
 * articles count once per photographer link, which is exactly what the
 * editor wants here — "what would I lose if I trashed this CPT?"
 */
function tpj_render_photographer_backlinks_meta_box( $post ) {
	global $wpdb;

	$rows = $wpdb->get_results( $wpdb->prepare(
		"SELECT p.ID, p.post_title, p.post_status, p.post_type, p.post_date
		 FROM {$wpdb->postmeta} pm
		 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
		 WHERE pm.meta_key = %s
		   AND pm.meta_value = %s
		   AND p.post_type IN ('essay','interview','feature')
		   AND p.post_status IN ('publish','draft','pending','private')
		 ORDER BY p.post_date DESC",
		'tpj_photographer',
		(string) $post->ID
	) );

	echo '<style>
		.tpj-backlinks-empty { color: #888; margin: 4px 0 8px; }
		.tpj-backlinks-list { list-style: none; padding: 0; margin: 0; }
		.tpj-backlinks-list li {
			padding: 8px 0;
			border-bottom: 1px solid #f0f0f0;
		}
		.tpj-backlinks-list li:last-child { border-bottom: none; }
		.tpj-backlinks-list a { font-weight: 600; }
		.tpj-backlinks-meta {
			color: #888;
			font-size: 12px;
			display: block;
			margin-top: 2px;
		}
		.tpj-backlinks-status-draft   { color: #b26500; }
		.tpj-backlinks-status-pending { color: #b26500; }
		.tpj-backlinks-status-private { color: #6e6e6e; }
	</style>';

	if ( empty( $rows ) ) {
		echo '<p class="tpj-backlinks-empty">No articles credit this photographer yet.</p>';
		echo '<p class="tpj-backlinks-empty">Linked when an article\'s text-credit field resolves to this slug (via <code>wp tpj relink-photographers</code>) or when an editor picks this photographer in the article meta box.</p>';
		return;
	}

	printf(
		'<p class="tpj-backlinks-empty">%d linked %s.</p>',
		count( $rows ),
		count( $rows ) === 1 ? 'article' : 'articles'
	);

	echo '<ul class="tpj-backlinks-list">';
	foreach ( $rows as $r ) {
		$edit_url = get_edit_post_link( $r->ID );
		$status_class = 'tpj-backlinks-status-' . sanitize_html_class( $r->post_status );
		$status_label = $r->post_status === 'publish' ? '' : ' · ' . ucfirst( $r->post_status );

		printf(
			'<li>
				<a href="%1$s">%2$s</a>
				<span class="tpj-backlinks-meta %3$s">%4$s · %5$s%6$s</span>
			</li>',
			esc_url( $edit_url ),
			esc_html( $r->post_title ),
			esc_attr( $status_class ),
			esc_html( ucfirst( $r->post_type ) ),
			esc_html( mysql2date( 'M j, Y', $r->post_date ) ),
			esc_html( $status_label )
		);
	}
	echo '</ul>';
}
