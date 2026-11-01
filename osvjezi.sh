#!/bin/bash
# Skripta za ručno povlačenje najnovijih dražbi s FINA-e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================="
echo "   Povlačenje najnovijih dražbi s FINA-e...      "
echo "================================================="

ruby fetcher.rb

echo ""
echo "Podaci su uspješno osvježeni i spremljeni!"
echo "Ako želiš ažurirati Netlify stranicu, samo ponovno povuci mapu 'public' na https://app.netlify.com/drop"
