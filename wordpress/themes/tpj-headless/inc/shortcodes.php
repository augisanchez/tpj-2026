<?php
/**
 * TPJ V2 server-side shortcode handlers.
 *
 * The v1 archive uses two custom shortcodes that the v1 theme rendered
 * directly. In headless mode WPGraphQL still runs `the_content` (which
 * runs `do_shortcode`), so we just need to re-register the handlers
 * here to produce semantic HTML the Next.js layer can style.
 *
 * Build Plan §"Shortcode handling" — server-side rendering chosen over
 * client-side parsing because the markup is static.
 *
 * Quirks observed in the dump (see project_tpj_v2_sql_reality memory):
 *   - [fig] class values include both camelCase (twoThirds, twoUp) and
 *     kebab-case (two-thirds, two-up). We normalize to a single
 *     lowercase token.
 *   - [int] uses `person =\\'1\\'` with a space before the equals sign
 *     in some posts — WordPress's shortcode parser handles that.
 *   - Some [fig] tags have caption HTML pasted into the class attribute.
 *     We strip class values that contain angle brackets defensively.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', function () {
	add_shortcode( 'fig', 'tpj_render_fig' );
	add_shortcode( 'int', 'tpj_render_int' );
}, 5 );

/**
 * wpautop wraps the entire [fig]...[/fig] shortcode in <p> tags before
 * do_shortcode runs. After our handler emits a <figure>, the result is
 * <p><figure>...</figure></p>, which is invalid HTML — browsers auto-close
 * the <p> right before the <figure>, leaving a stray </p>.
 *
 * Run after do_shortcode (priority 11) and clean the malformed wrapping.
 */
add_filter( 'the_content', function ( $content ) {
	$content = preg_replace( '/<p>\s*(<figure\b[^>]*>)/i', '$1', $content );
	$content = preg_replace( '/(<\/figure>)\s*<\/p>/i', '$1', $content );
	return $content;
}, 99 );

/**
 * [fig class="twoThirds" caption="..."]<img ...>[/fig]
 */
function tpj_render_fig( $atts, $content = '' ) {
	$atts = shortcode_atts(
		[
			'class'   => '',
			'caption' => '',
		],
		$atts,
		'fig'
	);

	$class_raw = is_string( $atts['class'] ) ? $atts['class'] : '';

	if ( strpos( $class_raw, '<' ) !== false || strpos( $class_raw, '>' ) !== false ) {
		$class_raw = '';
	}

	$class_norm = preg_replace( '/[^a-zA-Z0-9-]/', '-', $class_raw );
	$class_norm = strtolower( $class_norm );
	$class_attr = $class_norm ? ' fig-' . esc_attr( $class_norm ) : '';

	// wpautop runs before do_shortcode and wraps the inner <img> tags in
	// <p> tags plus stray <br /> separators. Inside a <figure> element
	// those add no semantic value and break the two-up grid layout, so
	// strip them before passing to do_shortcode.
	$content = preg_replace( '/<\/?p[^>]*>/i', '', $content );
	$content = preg_replace( '/<br\s*\/?>/i', '', $content );
	$content = trim( $content );

	$inner = do_shortcode( $content );

	// If the content already contains an inline <figcaption>, respect it
	// and don't append another one from the `caption` attribute.
	$has_inline_caption = stripos( $inner, '<figcaption' ) !== false;

	$caption_html = '';
	if ( ! $has_inline_caption && ! empty( $atts['caption'] ) ) {
		$caption_html = '<figcaption>' . tpj_clean_caption( $atts['caption'] ) . '</figcaption>';
	}

	return sprintf( '<figure class="fig%s">%s%s</figure>', $class_attr, $inner, $caption_html );
}

/**
 * Clean a caption value coming out of the shortcode parser.
 *
 * wpautop runs on the raw post_content (including text inside shortcode
 * attribute values), so multi-line caption attributes arrive with stray
 * <br /> tags and embedded <p>/</p> wrappers around paragraph breaks.
 * Inside a <figcaption> those tags are invalid HTML and the browser
 * silently injects empty <p> shells, breaking layout.
 *
 * Result: trim leading/trailing line breaks, convert paragraph breaks
 * into a double <br /> so multi-image captions still visually separate,
 * then strip remaining <p> tags.
 */
function tpj_clean_caption( $raw ) {
	$caption = wp_kses_post( $raw );
	$caption = preg_replace( '/^(\s*(<br\s*\/?>|<p[^>]*>)\s*)+/i', '', $caption );
	$caption = preg_replace( '/(\s*(<br\s*\/?>|<\/p>)\s*)+$/i', '', $caption );
	$caption = preg_replace( '/<\/p>\s*<p[^>]*>/i', '<br /><br />', $caption );
	$caption = preg_replace( '/<\/?p[^>]*>/i', '', $caption );
	return $caption;
}

/**
 * [int person='1' text='...' first='x']
 *
 * person='1' is the interviewer's question, person='2' is the subject's
 * answer. The frontend styles `.int-q` in Inter Semi-Bold and `.int-a`
 * in Source Serif 4 Regular, with sibling selectors driving the spacing
 * between turns and pairs.
 */
function tpj_render_int( $atts ) {
	$atts = shortcode_atts(
		[
			'person' => '1',
			'text'   => '',
			'first'  => '',
		],
		$atts,
		'int'
	);

	$person      = trim( (string) $atts['person'] ) === '2' ? '2' : '1';
	$is_question = $person === '1';
	$class       = $is_question ? 'int int-q' : 'int int-a';
	if ( $atts['first'] !== '' ) {
		$class .= ' int-first';
	}

	$text = wp_kses_post( $atts['text'] );

	return sprintf( '<p class="%s">%s</p>', esc_attr( $class ), $text );
}
