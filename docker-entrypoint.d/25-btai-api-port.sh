#!/bin/sh

set -eu

: "${BTAI_API_PORT:?BTAI_API_PORT must be set}"
case "$BTAI_API_PORT" in
  *[!0-9]*)
    echo "BTAI_API_PORT must be numeric" >&2
    exit 1
    ;;
esac

: "${CLI_API_PORT:?CLI_API_PORT must be set}"
case "$CLI_API_PORT" in
  *[!0-9]*)
    echo "CLI_API_PORT must be numeric" >&2
    exit 1
    ;;
esac

sed -e "s/\${BTAI_API_PORT}/$BTAI_API_PORT/g" \
    -e "s/\${CLI_API_PORT}/$CLI_API_PORT/g" \
  /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
