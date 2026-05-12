<?php
/**
 * Admin-side UI for the editorial photographer picker workflow.
 * Separate from photographer-meta.php so that file stays focused on
 * the editable meta-box fields on the Photographer CPT, while this
 * file owns:
 *
 *  1. Linked Articles meta box on the Photographer CPT — read-only
 *     list of articles that credit this photographer.
 *  2. Photographer picker meta box on essay/interview/feature CPTs —
 *     searchable, multi-select picker that replaces the legacy
 *     "type into a text field" workflow. Writes tpj_photographer
 *     postmeta (multi-row, ordered) and derives the legacy
 *     `photographer` text credit on save.
 *
 * Planned (not yet built — see project_tpj_editorial_picker.md):
 *  - Slug-locked-after-publish guard.
 *  - Drag-to-reorder selected chips (step 8).
 *  - Inline "Add new" form invoking the create REST endpoint (step 7).
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

/* -------------------------------------------------------------------- */
/* Photographer picker meta box — on essay / interview / feature edit   */
/* screens. Lets editors search the Photographer CPT and assign one or  */
/* more as credits via a chip-based UI. Renders an empty shell server-  */
/* side; assets/article-photographer-picker.js hydrates it.             */
/* -------------------------------------------------------------------- */

const TPJ_PICKER_POST_TYPES = [ 'essay', 'interview', 'feature' ];

add_action( 'add_meta_boxes', function () {
	foreach ( TPJ_PICKER_POST_TYPES as $type ) {
		add_meta_box(
			'tpj_photographer_picker',
			'Photographer Credit',
			'tpj_render_photographer_picker_meta_box',
			$type,
			'side',
			'high'
		);
	}
} );

/**
 * Enqueue the picker JS/CSS only on the article edit screens where the
 * meta box renders.
 */
add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( ! in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->post_type, TPJ_PICKER_POST_TYPES, true ) ) {
		return;
	}

	$theme_uri = get_template_directory_uri();
	wp_enqueue_style(
		'tpj-photographer-picker',
		$theme_uri . '/assets/article-photographer-picker.css',
		[],
		'1.0.0'
	);
	wp_enqueue_script(
		'tpj-photographer-picker',
		$theme_uri . '/assets/article-photographer-picker.js',
		[],
		'1.0.0',
		true
	);
} );

/**
 * Render the picker shell with initial selection hydrated server-side.
 * The JS reads container data-* attributes and takes over from there.
 */
function tpj_render_photographer_picker_meta_box( $post ) {
	wp_nonce_field( 'tpj_photographer_picker', 'tpj_photographer_picker_nonce' );

	$linked_ids = tpj_get_photographer_links( $post->ID );

	// Hydrate each linked photographer's metadata server-side so the
	// chips render with full info on first paint (no spinner-then-fill
	// flash, no extra REST round trip).
	global $wpdb;
	$initial = [];
	foreach ( $linked_ids as $id ) {
		$photog = get_post( $id );
		if ( ! $photog || $photog->post_type !== 'photographer' ) {
			continue;
		}
		$article_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->postmeta}
			 WHERE meta_key = 'tpj_photographer' AND meta_value = %s",
			(string) $id
		) );
		$portrait = get_post_meta( $id, 'tpj_portrait_url', true );
		$location = get_post_meta( $id, 'tpj_location', true );
		$initial[] = [
			'id'            => (int) $id,
			'name'          => $photog->post_title,
			'slug'          => $photog->post_name,
			'portrait'      => $portrait !== '' ? $portrait : null,
			'location'      => $location !== '' ? $location : null,
			'atomic_combo'  => (bool) get_post_meta( $id, 'tpj_atomic_combo', true ),
			'article_count' => $article_count,
		];
	}

	$rest_url   = rest_url( 'tpj/v1/photographers/search' );
	$rest_nonce = wp_create_nonce( 'wp_rest' );
	?>
	<div class="tpj-picker"
	     data-initial="<?php echo esc_attr( wp_json_encode( $initial ) ); ?>"
	     data-rest-url="<?php echo esc_attr( $rest_url ); ?>"
	     data-rest-nonce="<?php echo esc_attr( $rest_nonce ); ?>">
		<input
			type="hidden"
			name="tpj_photographer_ids"
			value="<?php echo esc_attr( wp_json_encode( array_map( 'intval', array_column( $initial, 'id' ) ) ) ); ?>"
		/>

		<div class="tpj-picker-chips"></div>
		<p class="tpj-picker-empty" <?php echo empty( $initial ) ? '' : 'hidden'; ?>>
			No photographer assigned. Search below to add one.
		</p>

		<div class="tpj-picker-search">
			<input
				type="search"
				class="tpj-picker-search-input"
				placeholder="Search photographers…"
				autocomplete="off"
			/>
			<div class="tpj-picker-results" hidden></div>
		</div>

		<p class="tpj-picker-note">
			Photographer credit only. List crew (MUA, stylist, models) in the article body.
		</p>
	</div>
	<?php
}

/**
 * Save handler. Reads the hidden tpj_photographer_ids JSON input,
 * validates each ID resolves to a published photographer, writes the
 * multi-row tpj_photographer postmeta, and derives the legacy
 * `photographer` text credit (joined with " & ") so both fields stay
 * in sync from a single source.
 */
add_action( 'save_post', function ( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || ! in_array( $post->post_type, TPJ_PICKER_POST_TYPES, true ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( wp_is_post_revision( $post_id ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	if ( ! isset( $_POST['tpj_photographer_picker_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce(
		sanitize_text_field( wp_unslash( $_POST['tpj_photographer_picker_nonce'] ) ),
		'tpj_photographer_picker'
	) ) {
		return;
	}

	$raw = isset( $_POST['tpj_photographer_ids'] )
		? wp_unslash( $_POST['tpj_photographer_ids'] )
		: '[]';
	$ids = json_decode( $raw, true );
	if ( ! is_array( $ids ) ) {
		return;
	}

	// Validate every ID is a published photographer. Filters out junk
	// from a tampered payload or stale data (e.g. an ID that got
	// trashed between page-load and save).
	$valid_ids = [];
	$names     = [];
	foreach ( $ids as $id ) {
		$id     = (int) $id;
		$photog = get_post( $id );
		if ( $photog && $photog->post_type === 'photographer' && $photog->post_status === 'publish' ) {
			$valid_ids[] = $id;
			$names[]     = html_entity_decode( $photog->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		}
	}

	tpj_set_photographer_links( $post_id, $valid_ids );

	if ( ! empty( $names ) ) {
		update_post_meta( $post_id, 'photographer', implode( ' & ', $names ) );
	} else {
		delete_post_meta( $post_id, 'photographer' );
	}
} );
