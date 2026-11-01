#!/bin/bash
# Skripta za jednostavno pokretanje FINA Dražbe Plus

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================="
echo "   Pokretanje aplikacije: FINA Dražbe Plus       "
echo "================================================="

# Provjera je li port 3000 već zauzet
PID=$(lsof -ti:3000)
if [ ! -z "$PID" ]; then
  echo "Zatvaram prethodno pokrenuti poslužitelj na portu 3000 (PID: $PID)..."
  kill -9 $PID 2>/dev/null
  sleep 1
fi

# Otvaranje stranice u web pregledniku nakon kratke pauze
(sleep 1.5 && open "http://localhost:3000") &

# Pokretanje poslužitelja
ruby server.rb
