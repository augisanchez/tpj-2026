<?php
/**
 * Admin post-list extensions for essay / interview / feature edit
 * screens:
 *
 *   1. Custom "Staff Pick" column with a visible badge for flagged
 *      articles. Sortable, so editors can group all staff picks at
 *      the top of the list.
 *   2. Quick Edit support: the inline edit row gets a checkbox so
 *      the flag can be toggled without opening the article.
 *   3. Bulk Actions: "Mark as staff pick" / "Remove staff pick" so
 *      an editor can apply the flag across many articles at once.
 *
 * The underlying postmeta key (`tpj_staff_pick`) is registered in
 * inc/article-panels.php; this file only adds list-screen UI.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const TPJ_ARTICLE_ADMIN_POST_TYPES = [ 'essay', 'interview', 'feature' ];
const TPJ_STAFF_PICK_COLUMN = 'tpj_staff_pick';

// ── List column ───────────────────────────────────────────────

foreach ( TPJ_ARTICLE_ADMIN_POST_TYPES as $type ) {
	add_filter( "manage_{$type}_posts_columns", 'tpj_add_staff_pick_column' );
	add_action(
		"manage_{$type}_posts_custom_column",
		'tpj_render_staff_pick_column',
		10,
		2
	);
	add_filter( "manage_edit-{$type}_sortable_columns", 'tpj_make_staff_pick_sortable' );
}

function tpj_add_staff_pick_column( $columns ) {
	// Inject the column right after Title so it sits at the front
	// of the editor's scanning path.
	$out = [];
	foreach ( $columns as $key => $label ) {
		$out[ $key ] = $label;
		if ( $key === 'title' ) {
			$out[ TPJ_STAFF_PICK_COLUMN ] = 'Staff Pick';
		}
	}
	if ( ! isset( $out[ TPJ_STAFF_PICK_COLUMN ] ) ) {
		$out[ TPJ_STAFF_PICK_COLUMN ] = 'Staff Pick';
	}
	return $out;
}

function tpj_render_staff_pick_column( $column, $post_id ) {
	if ( $column !== TPJ_STAFF_PICK_COLUMN ) {
		return;
	}
	$is_pick = (bool) get_post_meta( $post_id, 'tpj_staff_pick', true );
	// Hidden span carries the value for our Quick Edit JS to read on
	// row click. Visible badge is the editor-facing cue.
	printf(
		'<span class="tpj-staff-pick-value" style="display:none;">%d</span>',
		$is_pick ? 1 : 0
	);
	if ( $is_pick ) {
		echo '<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:#e4ffb1;color:#1a1814;font-weight:700;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">★ Staff Pick</span>';
	} else {
		echo '<span style="color:#8c8f94;font-size:12px;">—</span>';
	}
}

function tpj_make_staff_pick_sortable( $columns ) {
	$columns[ TPJ_STAFF_PICK_COLUMN ] = 'tpj_staff_pick';
	return $columns;
}

add_action( 'pre_get_posts', 'tpj_staff_pick_sort_query' );

function tpj_staff_pick_sort_query( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( $query->get( 'orderby' ) !== 'tpj_staff_pick' ) {
		return;
	}
	// Sort by the staff-pick meta, then by date as a stable tiebreaker.
	$query->set( 'meta_key', 'tpj_staff_pick' );
	$query->set( 'orderby', [ 'meta_value_num' => $query->get( 'order' ), 'date' => 'DESC' ] );
}

// ── Quick Edit checkbox ───────────────────────────────────────

add_action( 'quick_edit_custom_box', 'tpj_render_quick_edit_staff_pick', 10, 2 );

function tpj_render_quick_edit_staff_pick( $column_name, $post_type ) {
	if ( $column_name !== TPJ_STAFF_PICK_COLUMN ) {
		return;
	}
	if ( ! in_array( $post_type, TPJ_ARTICLE_ADMIN_POST_TYPES, true ) ) {
		return;
	}
	// The current value gets populated by the inline JS that reads
	// the hidden span we stamped in the column renderer above; this
	// markup just provides the input.
	wp_nonce_field( 'tpj_quick_edit_staff_pick', 'tpj_quick_edit_staff_pick_nonce' );
	?>
	<fieldset class="inline-edit-col-right">
		<div class="inline-edit-col">
			<label class="inline-edit-staff-pick alignleft">
				<input type="checkbox" name="tpj_staff_pick" value="1" />
				<span class="checkbox-title">Staff pick</span>
			</label>
		</div>
	</fieldset>
	<?php
}

add_action( 'admin_enqueue_scripts', 'tpj_enqueue_quick_edit_script' );

function tpj_enqueue_quick_edit_script( $hook ) {
	if ( $hook !== 'edit.php' ) {
		return;
	}
	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->post_type, TPJ_ARTICLE_ADMIN_POST_TYPES, true ) ) {
		return;
	}

	$inline = <<<'JS'
( function () {
	if ( typeof inlineEditPost === 'undefined' ) return;
	var origEdit = inlineEditPost.edit;
	inlineEditPost.edit = function ( id ) {
		origEdit.apply( this, arguments );
		var postId = 0;
		if ( typeof id === 'object' ) {
			postId = parseInt( this.getId( id ), 10 );
		} else {
			postId = parseInt( id, 10 );
		}
		if ( ! postId ) return;
		var row = document.getElementById( 'post-' + postId );
		if ( ! row ) return;
		var valueEl = row.querySelector( '.tpj-staff-pick-value' );
		var isPick = valueEl && valueEl.textContent.trim() === '1';
		var editRow = document.getElementById( 'edit-' + postId );
		if ( ! editRow ) return;
		var checkbox = editRow.querySelector( 'input[name="tpj_staff_pick"]' );
		if ( checkbox ) checkbox.checked = isPick;
	};
} )();
JS;

	wp_register_script( 'tpj-quick-edit', '', [ 'inline-edit-post' ], null, true );
	wp_enqueue_script( 'tpj-quick-edit' );
	wp_add_inline_script( 'tpj-quick-edit', $inline );
}

add_action( 'save_post', 'tpj_save_quick_edit_staff_pick', 10, 2 );

function tpj_save_quick_edit_staff_pick( $post_id, $post ) {
	if ( ! in_array( $post->post_type, TPJ_ARTICLE_ADMIN_POST_TYPES, true ) ) {
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
	// Only act when the Quick Edit nonce came through — the sidebar
	// panel saves go through REST, not save_post, so we won't clobber
	// the toggle when the editor saves from the Gutenberg sidebar.
	if ( ! isset( $_POST['tpj_quick_edit_staff_pick_nonce'] ) ) {
		return;
	}
	if ( ! wp_verify_nonce(
		sanitize_text_field( wp_unslash( $_POST['tpj_quick_edit_staff_pick_nonce'] ) ),
		'tpj_quick_edit_staff_pick'
	) ) {
		return;
	}

	$next = ! empty( $_POST['tpj_staff_pick'] ) ? 1 : 0;
	if ( $next ) {
		update_post_meta( $post_id, 'tpj_staff_pick', 1 );
	} else {
		delete_post_meta( $post_id, 'tpj_staff_pick' );
	}
}

// ── Bulk Actions ──────────────────────────────────────────────

foreach ( TPJ_ARTICLE_ADMIN_POST_TYPES as $type ) {
	add_filter( "bulk_actions-edit-{$type}", 'tpj_register_bulk_staff_pick_actions' );
	add_filter(
		"handle_bulk_actions-edit-{$type}",
		'tpj_handle_bulk_staff_pick_action',
		10,
		3
	);
}

function tpj_register_bulk_staff_pick_actions( $actions ) {
	$actions['tpj_mark_staff_pick']   = 'Mark as staff pick';
	$actions['tpj_unmark_staff_pick'] = 'Remove staff pick';
	return $actions;
}

function tpj_handle_bulk_staff_pick_action( $redirect, $action, $post_ids ) {
	if ( $action !== 'tpj_mark_staff_pick' && $action !== 'tpj_unmark_staff_pick' ) {
		return $redirect;
	}
	$mark = $action === 'tpj_mark_staff_pick';
	$applied = 0;
	foreach ( $post_ids as $post_id ) {
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			continue;
		}
		if ( $mark ) {
			update_post_meta( $post_id, 'tpj_staff_pick', 1 );
		} else {
			delete_post_meta( $post_id, 'tpj_staff_pick' );
		}
		$applied++;
	}
	$redirect = add_query_arg(
		$mark ? 'tpj_bulk_marked' : 'tpj_bulk_unmarked',
		$applied,
		$redirect
	);
	return $redirect;
}

add_action( 'admin_notices', 'tpj_bulk_staff_pick_admin_notice' );

function tpj_bulk_staff_pick_admin_notice() {
	if ( ! empty( $_REQUEST['tpj_bulk_marked'] ) ) {
		$count = (int) $_REQUEST['tpj_bulk_marked'];
		printf(
			'<div class="notice notice-success is-dismissible"><p>%d %s marked as staff pick.</p></div>',
			$count,
			$count === 1 ? 'article' : 'articles'
		);
	}
	if ( ! empty( $_REQUEST['tpj_bulk_unmarked'] ) ) {
		$count = (int) $_REQUEST['tpj_bulk_unmarked'];
		printf(
			'<div class="notice notice-success is-dismissible"><p>Staff pick removed from %d %s.</p></div>',
			$count,
			$count === 1 ? 'article' : 'articles'
		);
	}
}
