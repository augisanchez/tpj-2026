<?php
/**
 * Copy new uploads (original + every generated size) to the Cloudflare R2
 * media bucket, so media.thephotographicjournal.com serves them like the
 * archive. Add-only: never deletes from R2.
 *
 * wp-config constants (feature off without them):
 *   TPJ_R2_ENDPOINT  https://<account>.r2.cloudflarestorage.com
 *   TPJ_R2_KEY / TPJ_R2_SECRET   R2 API token (Object Read & Write, tpj-media)
 *   TPJ_R2_BUCKET    tpj-media
 *   TPJ_R2_PREFIX    tpj/wp-content/uploads/
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function tpj_r2_enabled() {
	foreach ( [ 'TPJ_R2_ENDPOINT', 'TPJ_R2_KEY', 'TPJ_R2_SECRET', 'TPJ_R2_BUCKET', 'TPJ_R2_PREFIX' ] as $c ) {
		if ( ! defined( $c ) || ! constant( $c ) ) {
			return false;
		}
	}
	return true;
}

/** PUT one local file to R2 with AWS Signature V4 (region "auto"). */
function tpj_r2_put( $local_path, $key ) {
	if ( ! is_readable( $local_path ) ) {
		return false;
	}
	$body    = file_get_contents( $local_path );
	$host    = wp_parse_url( TPJ_R2_ENDPOINT, PHP_URL_HOST );
	$path    = '/' . TPJ_R2_BUCKET . '/' . implode( '/', array_map( 'rawurlencode', explode( '/', $key ) ) );
	$type    = wp_check_filetype( $local_path )['type'] ?: 'application/octet-stream';
	$now     = gmdate( 'Ymd\THis\Z' );
	$date    = substr( $now, 0, 8 );
	$hash    = hash( 'sha256', $body );
	$headers = [ 'content-type' => $type, 'host' => $host, 'x-amz-content-sha256' => $hash, 'x-amz-date' => $now ];
	ksort( $headers );
	$canon_h = '';
	foreach ( $headers as $k => $v ) {
		$canon_h .= $k . ':' . trim( $v ) . "\n";
	}
	$signed  = implode( ';', array_keys( $headers ) );
	$request = "PUT\n{$path}\n\n{$canon_h}\n{$signed}\n{$hash}";
	$scope   = "{$date}/auto/s3/aws4_request";
	$to_sign = "AWS4-HMAC-SHA256\n{$now}\n{$scope}\n" . hash( 'sha256', $request );
	$k       = hash_hmac( 'sha256', 'aws4_request', hash_hmac( 'sha256', 's3', hash_hmac( 'sha256', 'auto', hash_hmac( 'sha256', $date, 'AWS4' . TPJ_R2_SECRET, true ), true ), true ), true );
	$sig     = hash_hmac( 'sha256', $to_sign, $k );
	$res     = wp_remote_request( 'https://' . $host . $path, [
		'method'  => 'PUT',
		'timeout' => 30,
		'body'    => $body,
		'headers' => [
			'Content-Type'         => $type,
			'x-amz-content-sha256' => $hash,
			'x-amz-date'           => $now,
			'Authorization'        => "AWS4-HMAC-SHA256 Credential=" . TPJ_R2_KEY . "/{$scope}, SignedHeaders={$signed}, Signature={$sig}",
		],
	] );
	return ! is_wp_error( $res ) && 200 === wp_remote_retrieve_response_code( $res );
}

/** After WordPress generates sizes, push the original and every size. */
add_filter( 'wp_generate_attachment_metadata', function ( $meta, $attachment_id ) {
	if ( ! tpj_r2_enabled() || empty( $meta['file'] ) ) {
		return $meta;
	}
	$uploads = wp_get_upload_dir();
	$dir     = trailingslashit( dirname( $meta['file'] ) );
	$files   = [ $meta['file'] ];
	if ( ! empty( $meta['original_image'] ) ) {
		$files[] = $dir . $meta['original_image'];
	}
	foreach ( (array) ( $meta['sizes'] ?? [] ) as $size ) {
		if ( ! empty( $size['file'] ) ) {
			$files[] = $dir . $size['file'];
		}
	}
	$failed = [];
	foreach ( array_unique( $files ) as $rel ) {
		if ( ! tpj_r2_put( trailingslashit( $uploads['basedir'] ) . $rel, TPJ_R2_PREFIX . ltrim( $rel, '/' ) ) ) {
			$failed[] = $rel;
		}
	}
	if ( $failed ) {
		error_log( 'tpj r2-sync: failed for attachment ' . $attachment_id . ': ' . implode( ', ', $failed ) );
	}
	return $meta;
}, 20, 2 );
