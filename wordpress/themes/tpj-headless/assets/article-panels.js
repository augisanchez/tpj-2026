/**
 * Gutenberg sidebar panels for essay / interview / feature edit
 * screens. Plain JS using wp.* globals (no build step) — matches
 * the project's no-bundler convention used in
 * article-photographer-picker.js.
 *
 * Two panels per article type:
 *   - "Article details" (intro + byline author)
 *   - "Hero image" (media-library picker)
 *
 * Saves flow through the REST API. The postmeta keys are
 * registered with show_in_rest in inc/article-panels.php.
 */
( function ( wp ) {
	if (
		! wp ||
		! wp.plugins ||
		! wp.editPost ||
		! wp.element ||
		! wp.components ||
		! wp.data ||
		! wp.blockEditor
	) {
		return;
	}

	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editPost.PluginDocumentSettingPanel;
	var createElement = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var TextareaControl = wp.components.TextareaControl;
	var TextControl = wp.components.TextControl;
	var ToggleControl = wp.components.ToggleControl;
	var Button = wp.components.Button;
	var MediaUpload = wp.blockEditor.MediaUpload;
	var MediaUploadCheck = wp.blockEditor.MediaUploadCheck;

	var BYLINE_KEY = 'tpj_byline_author';
	var HERO_KEY = '_tpj_hero_image_id';
	var INTRO_KEY = 'intro';
	var STAFF_PICK_KEY = 'tpj_staff_pick';

	// Author-field labels per CPT. Essays don't credit a separate
	// prose author — photographs by X is the byline.
	var AUTHOR_LABELS = {
		feature: {
			label: 'Writer',
			help: 'Byline credit for the prose author (book reviews, travel essays). Photo credits come from the Photographer field below.',
		},
		interview: {
			label: 'Interviewer',
			help: 'Credit for the person who conducted the interview. Photographer credits stay separate.',
		},
	};

	function useMeta( key, fallback ) {
		var meta = useSelect( function ( select ) {
			return select( 'core/editor' ).getEditedPostAttribute( 'meta' ) || {};
		}, [] );
		var dispatch = useDispatch( 'core/editor' );
		var value = meta[ key ];
		if ( value === undefined || value === null ) {
			value = fallback;
		}
		var setValue = function ( next ) {
			var update = {};
			update[ key ] = next;
			dispatch.editPost( { meta: update } );
		};
		return [ value, setValue ];
	}

	function usePostType() {
		return useSelect( function ( select ) {
			return select( 'core/editor' ).getCurrentPostType();
		}, [] );
	}

	function ArticleDetailsPanel() {
		var postType = usePostType();
		if ( ! AUTHOR_LABELS[ postType ] && postType !== 'essay' ) {
			return null;
		}

		var introState = useMeta( INTRO_KEY, '' );
		var authorState = useMeta( BYLINE_KEY, '' );
		var staffPickState = useMeta( STAFF_PICK_KEY, false );
		var intro = introState[ 0 ];
		var setIntro = introState[ 1 ];
		var author = authorState[ 0 ];
		var setAuthor = authorState[ 1 ];
		var staffPick = Boolean( staffPickState[ 0 ] );
		var setStaffPick = staffPickState[ 1 ];

		var authorMeta = AUTHOR_LABELS[ postType ];

		return createElement(
			PluginDocumentSettingPanel,
			{
				name: 'tpj-article-details',
				title: 'Article details',
				className: 'tpj-article-details-panel',
			},
			createElement( TextareaControl, {
				label: 'Article intro',
				help: 'Short standfirst paragraph shown above the body. Plain text; line breaks become paragraph breaks.',
				value: intro || '',
				onChange: setIntro,
				rows: 4,
				__nextHasNoMarginBottom: true,
			} ),
			authorMeta
				? createElement(
						'div',
						{ style: { marginTop: '16px' } },
						createElement( TextControl, {
							label: authorMeta.label,
							help: authorMeta.help,
							value: author || '',
							onChange: setAuthor,
							placeholder: 'Jane Doe',
							__nextHasNoMarginBottom: true,
						} )
				  )
				: null,
			createElement(
				'div',
				{ style: { marginTop: '16px' } },
				createElement( ToggleControl, {
					label: 'Staff pick',
					help: 'Highlight this article on the homepage hero carousel and weight it in Dive Deeper selection.',
					checked: staffPick,
					onChange: function ( next ) {
						setStaffPick( next ? true : false );
					},
					__nextHasNoMarginBottom: true,
				} )
			)
		);
	}

	function HeroImagePanel() {
		var postType = usePostType();
		var heroState = useMeta( HERO_KEY, 0 );
		var heroId = heroState[ 0 ];
		var setHeroId = heroState[ 1 ];

		// Resolve the selected attachment to a thumbnail URL via the
		// core/core-data store. Reads asynchronously the first time.
		var attachment = useSelect(
			function ( select ) {
				if ( ! heroId ) return null;
				return select( 'core' ).getEntityRecord(
					'postType',
					'attachment',
					heroId
				);
			},
			[ heroId ]
		);

		var previewUrl =
			attachment && attachment.media_details && attachment.media_details.sizes
				? ( attachment.media_details.sizes.medium &&
						attachment.media_details.sizes.medium.source_url ) ||
				  ( attachment.media_details.sizes.full &&
						attachment.media_details.sizes.full.source_url ) ||
				  attachment.source_url
				: attachment
				? attachment.source_url
				: null;

		var pickerButton = createElement(
			MediaUploadCheck,
			null,
			createElement( MediaUpload, {
				onSelect: function ( media ) {
					setHeroId( media.id ? Number( media.id ) : 0 );
				},
				allowedTypes: [ 'image' ],
				value: heroId,
				render: function ( renderProps ) {
					return createElement(
						Button,
						{
							variant: heroId ? 'secondary' : 'primary',
							onClick: renderProps.open,
						},
						heroId ? 'Replace hero image' : 'Set hero image'
					);
				},
			} )
		);

		var helpText = postType
			? 'Large image shown at the top of the article. Falls back to the Featured Image when empty.'
			: '';

		return createElement(
			PluginDocumentSettingPanel,
			{
				name: 'tpj-hero-image',
				title: 'Hero image',
				className: 'tpj-hero-image-panel',
			},
			previewUrl
				? createElement( 'img', {
						src: previewUrl,
						alt: '',
						style: {
							display: 'block',
							width: '100%',
							height: 'auto',
							marginBottom: '12px',
							borderRadius: '4px',
						},
				  } )
				: createElement(
						'p',
						{
							style: {
								margin: '0 0 12px',
								color: '#757575',
								fontStyle: 'italic',
							},
						},
						'No hero set. Article will use the Featured Image.'
				  ),
			createElement(
				'div',
				{ style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
				pickerButton,
				heroId
					? createElement(
							Button,
							{
								variant: 'tertiary',
								isDestructive: true,
								onClick: function () {
									setHeroId( 0 );
								},
							},
							'Clear'
					  )
					: null
			),
			createElement(
				'p',
				{
					style: {
						margin: '12px 0 0',
						color: '#757575',
						fontSize: '12px',
						lineHeight: 1.4,
					},
				},
				helpText
			)
		);
	}

	function ArticlePanels() {
		return createElement(
			Fragment,
			null,
			createElement( ArticleDetailsPanel, null ),
			createElement( HeroImagePanel, null )
		);
	}

	registerPlugin( 'tpj-article-panels', { render: ArticlePanels } );
} )( window.wp );
