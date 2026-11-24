/**
 * Editor experience for essays / interviews / features. Plain JS on
 * wp.* globals (no build step), matching article-panels.js.
 *
 *  - Cover image help text (the Featured image panel, relabelled).
 *  - Themes and Genres panels show each term's definition under it.
 *  - "Tag suggestions" panel: runs the archive tagger on this draft.
 *  - Pre-publish checks: genre, photographer credit, cover image.
 *
 * Server side: inc/editor-experience.php.
 */
( function ( wp, cfg ) {
	if ( ! wp || ! wp.plugins || ! wp.element || ! wp.data || ! wp.hooks ) return;

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var C = wp.components;
	var editPostPkg = wp.editor && wp.editor.PluginDocumentSettingPanel ? wp.editor : wp.editPost;
	var PluginDocumentSettingPanel = editPostPkg.PluginDocumentSettingPanel;
	var PluginPrePublishPanel = editPostPkg.PluginPrePublishPanel;
	cfg = cfg || { themes: {}, genres: {} };

	var DEFS = { 'tpj-theme': cfg.themes || {}, 'tpj-genre': cfg.genres || {} };
	var muted = { color: '#757575', fontSize: '12px', lineHeight: 1.4, margin: '8px 0 0' };

	/* Cover image: one line of help under the panel. ---------------- */
	wp.hooks.addFilter( 'editor.PostFeaturedImage', 'tpj/cover-image-help', function ( Original ) {
		return function ( props ) {
			return el(
				Fragment,
				null,
				el( Original, props ),
				el( 'p', { style: muted }, 'Shown on cards across the site, and as the hero unless a hero image is set.' )
			);
		};
	} );

	/* Themes / Genres with definitions. ------------------------------ */
	function TermChecklist( props ) {
		var slug = props.slug;
		var defs = DEFS[ slug ];
		var terms = useSelect( function ( select ) {
			return select( 'core' ).getEntityRecords( 'taxonomy', slug, { per_page: -1, hide_empty: false, orderby: 'name' } );
		}, [ slug ] );
		var selected = useSelect( function ( select ) {
			return select( 'core/editor' ).getEditedPostAttribute( slug ) || [];
		}, [ slug ] );
		var editPost = useDispatch( 'core/editor' ).editPost;
		if ( ! terms ) return el( C.Spinner );
		var toggle = function ( id, on ) {
			var next = selected.filter( function ( x ) { return x !== id; } );
			if ( on ) next.push( id );
			var u = {};
			u[ slug ] = next;
			editPost( u );
		};
		return el(
			'div',
			null,
			terms.map( function ( t ) {
				var def = defs[ t.slug ];
				return el(
					'div',
					{ key: t.id },
					el( C.CheckboxControl, {
						label: t.name,
						checked: selected.indexOf( t.id ) !== -1,
						onChange: function ( on ) { toggle( t.id, on ); },
						__nextHasNoMarginBottom: true,
					} ),
					def ? el( 'p', { className: 'tpj-term-help' }, def ) : null
				);
			} ),
			slug === 'tpj-theme'
				? el( 'p', { style: muted }, 'Up to 3, only when the work is genuinely about the question.' )
				: el( 'p', { style: muted }, '1 or 2. Dominant genre first.' )
		);
	}

	wp.hooks.addFilter( 'editor.PostTaxonomyType', 'tpj/term-definitions', function ( Original ) {
		return function ( props ) {
			if ( DEFS[ props.slug ] && Object.keys( DEFS[ props.slug ] ).length ) {
				return el( TermChecklist, { slug: props.slug } );
			}
			return el( Original, props );
		};
	} );

	/* Shared state readers. ------------------------------------------ */
	function photographerCount() {
		var input = document.querySelector( 'input[name="tpj_photographer_ids"]' );
		if ( ! input ) return null; // picker not on screen: don't block
		try {
			var v = JSON.parse( input.value || '[]' );
			return Array.isArray( v ) ? v.length : 0;
		} catch ( e ) {
			return 0;
		}
	}

	function currentChecks( select ) {
		var ed = select( 'core/editor' );
		var meta = ed.getEditedPostAttribute( 'meta' ) || {};
		var genres = ed.getEditedPostAttribute( 'tpj-genre' ) || [];
		var themes = ed.getEditedPostAttribute( 'tpj-theme' ) || [];
		var cover = ed.getEditedPostAttribute( 'featured_media' ) || meta._tpj_hero_image_id;
		var pc = photographerCount();
		return [
			{ ok: genres.length > 0, label: 'Genre', block: true },
			{ ok: pc === null || pc > 0, label: 'Photographer credit', block: true },
			{ ok: Boolean( cover ), label: 'Cover image', block: true },
			{ ok: themes.length <= 3, label: 'Themes: 3 or fewer', block: false },
		];
	}

	/* Block publishing when required pieces are missing. ------------- */
	wp.hooks.addFilter( 'editor.preSavePost', 'tpj/required-fields', function ( edits ) {
		var select = wp.data.select;
		var ed = select( 'core/editor' );
		var status = ( edits && edits.status ) || ed.getEditedPostAttribute( 'status' );
		var publishing = status === 'publish' || status === 'future';
		if ( ! publishing || ed.isAutosavingPost() ) return edits;
		var missing = currentChecks( select ).filter( function ( c ) { return c.block && ! c.ok; } );
		if ( missing.length ) {
			throw new Error( 'Before publishing, add: ' + missing.map( function ( m ) { return m.label.toLowerCase(); } ).join( ', ' ) + '.' );
		}
		return edits;
	} );

	function Checklist() {
		var checks = useSelect( currentChecks, [] );
		return el(
			'ul',
			{ style: { margin: 0 } },
			checks.map( function ( c ) {
				return el(
					'li',
					{ key: c.label, style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0', color: c.ok ? '#1e1e1e' : ( c.block ? '#b32d2e' : '#996800' ) } },
					el( 'span', { 'aria-hidden': true }, c.ok ? '✓' : '✕' ),
					c.label
				);
			} )
		);
	}

	/* Tag suggestions. ----------------------------------------------- */
	function imageUrls( select ) {
		var ed = select( 'core/editor' );
		var core = select( 'core' );
		var urls = [];
		var add = function ( id ) {
			var m = id ? core.getMedia( id ) : null;
			if ( m && m.source_url ) urls.push( ( m.media_details && m.media_details.sizes && m.media_details.sizes.large && m.media_details.sizes.large.source_url ) || m.source_url );
		};
		add( ed.getEditedPostAttribute( 'featured_media' ) );
		add( ( ed.getEditedPostAttribute( 'meta' ) || {} )._tpj_hero_image_id );
		var html = ed.getEditedPostContent() || '';
		var re = /<img[^>]+src=["']([^"']+)["']/gi;
		var m;
		while ( ( m = re.exec( html ) ) && urls.length < 5 ) urls.push( m[ 1 ] );
		return urls.filter( function ( u, i ) { return /^https?:/.test( u ) && urls.indexOf( u ) === i; } ).slice( 0, 5 );
	}

	function level( s ) {
		return s >= 80 ? 'High' : s >= 60 ? 'Medium' : 'Low';
	}

	function SuggestPanel() {
		var st = useState( { busy: false, error: null, data: null } );
		var state = st[ 0 ];
		var setState = st[ 1 ];
		var editPost = useDispatch( 'core/editor' ).editPost;
		var ctx = useSelect( function ( select ) {
			var ed = select( 'core/editor' );
			return {
				title: ed.getEditedPostAttribute( 'title' ),
				type: ed.getCurrentPostType(),
				intro: ( ed.getEditedPostAttribute( 'meta' ) || {} ).intro || '',
				content: ed.getEditedPostContent(),
				images: imageUrls( select ),
			};
		}, [] );

		if ( ! cfg.hasKey ) {
			return el( PluginDocumentSettingPanel, { name: 'tpj-suggest', title: 'Tag suggestions' },
				el( 'p', { style: muted }, cfg.isAdmin ? 'Add an Anthropic API key in Settings → TPJ to turn this on.' : 'Ask an administrator to add an API key in Settings → TPJ.' ) );
		}

		var run = function () {
			setState( { busy: true, error: null, data: null } );
			wp.apiFetch( { path: '/tpj/v1/suggest-tags', method: 'POST', data: ctx } )
				.then( function ( data ) { setState( { busy: false, error: null, data: data } ); } )
				.catch( function ( e ) { setState( { busy: false, error: e.message || 'Request failed.', data: null } ); } );
		};

		var apply = function () {
			var d = state.data;
			editPost( {
				'tpj-genre': d.genres.filter( function ( x ) { return x.recommended && x.term_id; } ).map( function ( x ) { return x.term_id; } ),
				'tpj-theme': d.themes.filter( function ( x ) { return x.recommended && x.term_id; } ).map( function ( x ) { return x.term_id; } ),
			} );
		};

		var row = function ( x, defs ) {
			return el( 'li', { key: x.slug, style: { margin: '0 0 10px' } },
				el( 'div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: x.recommended ? 600 : 400 } },
					el( 'span', null, ( x.recommended ? '✓ ' : '' ) + x.slug.replace( /-/g, ' ' ).replace( /\b\w/g, function ( c ) { return c.toUpperCase(); } ) ),
					el( 'span', { style: { color: '#757575' } }, x.score + ' · ' + level( x.score ) ) ),
				el( 'div', { style: muted }, x.evidence ) );
		};

		return el(
			PluginDocumentSettingPanel,
			{ name: 'tpj-suggest', title: 'Tag suggestions' },
			el( C.Button, { variant: 'secondary', onClick: run, isBusy: state.busy, disabled: state.busy }, state.busy ? 'Reading the article…' : 'Suggest tags' ),
			state.error ? el( 'p', { style: { color: '#b32d2e', margin: '8px 0 0' } }, state.error ) : null,
			state.data
				? el( Fragment, null,
						el( 'h4', { style: { margin: '16px 0 8px' } }, 'Genres' ),
						el( 'ul', { style: { margin: 0 } }, state.data.genres.map( row ) ),
						el( 'h4', { style: { margin: '12px 0 8px' } }, 'Themes' ),
						state.data.themes.length ? el( 'ul', { style: { margin: 0 } }, state.data.themes.map( row ) ) : el( 'p', { style: muted }, '—' ),
						el( C.Button, { variant: 'primary', onClick: apply, style: { marginTop: '8px' } }, 'Apply ✓ tags' ),
						el( 'p', { style: muted }, 'Replaces the genres and themes checked above. You can still edit them.' ) )
				: null
		);
	}

	function Panels() {
		return el(
			Fragment,
			null,
			el( SuggestPanel ),
			PluginPrePublishPanel
				? el( PluginPrePublishPanel, { title: 'Ready to publish?', initialOpen: true }, el( Checklist ) )
				: null
		);
	}

	wp.plugins.registerPlugin( 'tpj-editor-experience', { render: Panels } );
} )( window.wp, window.tpjEditor );
