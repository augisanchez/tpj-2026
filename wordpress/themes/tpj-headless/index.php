<?php
/**
 * The Photographic Journal V2 is rendered entirely by the Next.js
 * frontend at code/frontend/. WordPress is used as a headless content
 * store and never serves public HTML.
 *
 * This file exists only because WordPress requires index.php in every
 * standalone theme. It intentionally outputs nothing.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

http_response_code( 404 );
exit;
