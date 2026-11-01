# encoding: utf-8
require 'webrick'
require 'json'
require 'uri'
require_relative 'fetcher'

class FinaServer
  PORT = ENV['PORT'] ? ENV['PORT'].to_i : 3000
  PUBLIC_DIR = File.expand_path("public", __dir__)
  DATA_DIR = File.expand_path("data", __dir__)

  def self.start
    # Check if initial data exists
    listings_file = File.join(DATA_DIR, "listings.json")
    unless File.exist?(listings_file)
      puts "[Server] No data found. Fetching initial listings from FINA..."
      FinaFetcher.save_to_file(DATA_DIR)
    end

    server = WEBrick::HTTPServer.new(
      Port: PORT,
      BindAddress: '0.0.0.0',
      DocumentRoot: PUBLIC_DIR,
      Logger: WEBrick::Log.new($stdout, WEBrick::Log::WARN),
      AccessLog: []
    )

    # API: /api/listings
    server.mount_proc '/api/listings' do |req, res|
      res['Content-Type'] = 'application/json; charset=utf-8'
      res['Access-Control-Allow-Origin'] = '*'

      begin
        listings = JSON.parse(File.read(listings_file))

        # Query filters
        query = req.query['q'].to_s.strip.downcase
        counties = req.query['counties'].to_s.split(',').map(&:strip).reject(&:empty?)
        types = req.query['types'].to_s.split(',').map(&:strip).reject(&:empty?)
        price_min = req.query['price_min'] ? req.query['price_min'].to_f : nil
        price_max = req.query['price_max'] ? req.query['price_max'].to_f : nil
        sort = req.query['sort'].to_s

        filtered = listings.select do |item|
          match = true

          # County multi-select filter
          if !counties.empty?
            match = false unless counties.include?(item["zupanija"])
          end

          # Property type filter
          if match && !types.empty?
            match = false unless types.include?(item["glavnaVrsta"])
          end

          # Price min
          if match && price_min && price_min > 0
            price = item["pocetnaCijena"].to_f
            match = false if price < price_min
          end

          # Price max
          if match && price_max && price_max > 0
            price = item["pocetnaCijena"].to_f
            match = false if price > price_max
          end

          # Text query search (searches across grad, adresa, opis, poslovniBroj, sud, vrsta)
          if match && !query.empty?
            searchable_text = [
              item["glavniGrad"],
              item["glavnaAdresa"],
              item["poslovniBroj"],
              item["sud"],
              item["zupanija"],
              item["glavnaVrsta"],
              item["opis"]
            ].compact.join(" ").downcase

            match = false unless searchable_text.include?(query)
          end

          match
        end

        # Sorting
        case sort
        when 'price_asc'
          filtered.sort_by! { |i| i["pocetnaCijena"].to_f }
        when 'price_desc'
          filtered.sort_by! { |i| -i["pocetnaCijena"].to_f }
        when 'deadline_desc'
          filtered.sort_by! { |i| -(i["preostaloDanaJamcevina"] || 0) }
        else # default: deadline_asc (hitnije prvo)
          filtered.sort_by! { |i| i["preostaloDanaJamcevina"] || 9999 }
        end

        res.body = JSON.generate({
          total: filtered.length,
          all_count: listings.length,
          listings: filtered
        })
      rescue => e
        res.status = 500
        res.body = JSON.generate({ error: e.message })
      end
    end

    # API: /api/listing?uuid=...
    server.mount_proc '/api/listing' do |req, res|
      res['Content-Type'] = 'application/json; charset=utf-8'
      uuid = req.query['uuid'].to_s

      begin
        listings = JSON.parse(File.read(listings_file))
        item = listings.find { |l| l["uuid"] == uuid }
        if item
          res.body = JSON.generate(item)
        else
          res.status = 404
          res.body = JSON.generate({ error: "Oglas nije pronađen" })
        end
      rescue => e
        res.status = 500
        res.body = JSON.generate({ error: e.message })
      end
    end

    $sync_mutex = Mutex.new
    $is_syncing = false
    $sync_error = nil

    # API: /api/status
    server.mount_proc '/api/status' do |req, res|
      res['Content-Type'] = 'application/json; charset=utf-8'
      res['Access-Control-Allow-Origin'] = '*'
      status_file = File.join(DATA_DIR, "status.json")

      data = File.exist?(status_file) ? JSON.parse(File.read(status_file)) : {}
      data["is_syncing"] = $is_syncing
      data["sync_error"] = $sync_error if $sync_error
      res.body = JSON.generate(data)
    end

    # API: /api/sync (refresh data in background)
    server.mount_proc '/api/sync' do |req, res|
      res['Content-Type'] = 'application/json; charset=utf-8'
      res['Access-Control-Allow-Origin'] = '*'

      if $is_syncing
        res.body = JSON.generate({ status: "in_progress", message: "Osvježavanje je već u tijeku..." })
      else
        Thread.new do
          $sync_mutex.synchronize do
            $is_syncing = true
            $sync_error = nil
            begin
              FinaFetcher.save_to_file(DATA_DIR)
            rescue => e
              $sync_error = e.message
            ensure
              $is_syncing = false
            end
          end
        end
        res.body = JSON.generate({ status: "started", message: "Osvježavanje je pokrenuto!" })
      end
    end

    # Root redirect to index.html
    server.mount_proc '/' do |req, res|
      if req.path == '/'
        res.set_redirect(WEBrick::HTTPStatus::Found, '/index.html')
      else
        WEBrick::HTTPServlet::FileHandler.new(server, PUBLIC_DIR).service(req, res)
      end
    end

    trap('INT') { server.shutdown }
    trap('TERM') { server.shutdown }

    puts "========================================================"
    puts "  FINA Dražbe Plus - Poslužitelj je uspješno pokrenut!  "
    puts "  Adresa u pregledniku: http://localhost:#{PORT}         "
    puts "========================================================"
    server.start
  end
end

if __FILE__ == $0
  FinaServer.start
end
