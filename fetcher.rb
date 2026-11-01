# encoding: utf-8
require 'net/http'
require 'json'
require 'date'
require 'thread'

module FinaFetcher
  BASE_URL = "https://ponip.fina.hr/ocevidnik-web"

  # Standard Croatian counties list
  COUNTIES = [
    "Grad Zagreb",
    "Zagrebačka",
    "Krapinsko-zagorska",
    "Sisačko-moslavačka",
    "Karlovačka",
    "Varaždinska",
    "Koprivničko-križevačka",
    "Bjelovarsko-bilogorska",
    "Primorsko-goranska",
    "Ličko-senjska",
    "Virovitičko-podravska",
    "Požeško-slavonska",
    "Brodsko-posavska",
    "Zadarska",
    "Osječko-baranjska",
    "Šibensko-kninska",
    "Vukovarsko-srijemska",
    "Splitsko-dalmatinska",
    "Istarska",
    "Dubrovačko-neretvanska",
    "Međimurska"
  ].freeze

  COURT_TO_COUNTY = {
    "zagreb" => "Grad Zagreb",
    "velika gorica" => "Zagrebačka",
    "zaprešić" => "Zagrebačka",
    "samobor" => "Zagrebačka",
    "vrbovec" => "Zagrebačka",
    "ivanić" => "Zagrebačka",
    "dugo selo" => "Zagrebačka",
    "jastrebarsko" => "Zagrebačka",
    "sveti ivan zelina" => "Zagrebačka",
    "krapin" => "Krapinsko-zagorska",
    "zlatar" => "Krapinsko-zagorska",
    "zabok" => "Krapinsko-zagorska",
    "sisak" => "Sisačko-moslavačka",
    "kutin" => "Sisačko-moslavačka",
    "petrinj" => "Sisačko-moslavačka",
    "karlovac" => "Karlovačka",
    "ogulin" => "Karlovačka",
    "duga resa" => "Karlovačka",
    "varaždin" => "Varaždinska",
    "ivanec" => "Varaždinska",
    "koprivnic" => "Koprivničko-križevačka",
    "križev" => "Koprivničko-križevačka",
    "đurđevac" => "Koprivničko-križevačka",
    "bjelovar" => "Bjelovarsko-bilogorska",
    "čazm" => "Bjelovarsko-bilogorska",
    "daruvar" => "Bjelovarsko-bilogorska",
    "garešnic" => "Bjelovarsko-bilogorska",
    "rijek" => "Primorsko-goranska",
    "crikvenic" => "Primorsko-goranska",
    "krk" => "Primorsko-goranska",
    "opatij" => "Primorsko-goranska",
    "rab" => "Primorsko-goranska",
    "mali lošinj" => "Primorsko-goranska",
    "delnic" => "Primorsko-goranska",
    "gospić" => "Ličko-senjska",
    "otočac" => "Ličko-senjska",
    "virovitic" => "Virovitičko-podravska",
    "slatin" => "Virovitičko-podravska",
    "požeg" => "Požeško-slavonska",
    "pakrac" => "Požeško-slavonska",
    "slavonski brod" => "Brodsko-posavska",
    "nova gradiška" => "Brodsko-posavska",
    "zadar" => "Zadarska",
    "benkovac" => "Zadarska",
    "pag" => "Zadarska",
    "osijek" => "Osječko-baranjska",
    "đakov" => "Osječko-baranjska",
    "beli manastir" => "Osječko-baranjska",
    "valpov" => "Osječko-baranjska",
    "donji miholjac" => "Osječko-baranjska",
    "našic" => "Osječko-baranjska",
    "šibenik" => "Šibensko-kninska",
    "knin" => "Šibensko-kninska",
    "drniš" => "Šibensko-kninska",
    "vukovar" => "Vukovarsko-srijemska",
    "vinkovc" => "Vukovarsko-srijemska",
    "županj" => "Vukovarsko-srijemska",
    "otok" => "Vukovarsko-srijemska",
    "ilok" => "Vukovarsko-srijemska",
    "split" => "Splitsko-dalmatinska",
    "makarsk" => "Splitsko-dalmatinska",
    "sinj" => "Splitsko-dalmatinska",
    "trogir" => "Splitsko-dalmatinska",
    "imotsk" => "Splitsko-dalmatinska",
    "supetar" => "Splitsko-dalmatinska",
    "hvar" => "Splitsko-dalmatinska",
    "vrgorac" => "Splitsko-dalmatinska",
    "pula" => "Istarska",
    "pazin" => "Istarska",
    "poreč" => "Istarska",
    "rovinj" => "Istarska",
    "umag" => "Istarska",
    "labin" => "Istarska",
    "buj" => "Istarska",
    "dubrovnik" => "Dubrovačko-neretvanska",
    "metković" => "Dubrovačko-neretvanska",
    "ploče" => "Dubrovačko-neretvanska",
    "korčul" => "Dubrovačko-neretvanska",
    "čakovec" => "Međimurska",
    "prelog" => "Međimurska"
  }.freeze

  def self.normalize_county(raw, court = nil, grad = nil)
    c = raw.to_s.strip
    c = c.gsub(/\s*županija\s*$/i, "").strip

    COUNTIES.each do |canonical|
      return canonical if c.downcase == canonical.downcase
    end

    # Match partial
    COUNTIES.each do |canonical|
      return canonical if c.downcase.include?(canonical.downcase) || canonical.downcase.include?(c.downcase) && c.length > 4
    end

    # Fallback to court
    if court
      COURT_TO_COUNTY.each do |keyword, county|
        return county if court.downcase.include?(keyword)
      end
    end

    # Fallback to grad
    if grad
      COURT_TO_COUNTY.each do |keyword, county|
        return county if grad.downcase.include?(keyword)
      end
    end

    c.empty? ? "Ostalo / Nepoznato" : c
  end

  def self.categorize_type(type_str)
    t = type_str.to_s.downcase.strip
    if t.include?("stan") || t.include?("apartman")
      "Stan"
    elsif t.include?("kuć") || t.include?("stamben") || t.include?("vila") || t.include?("vikend")
      "Kuća"
    elsif t.include?("zemlj") || t.include?("oranic") || t.include?("livad") || t.include?("šum") || t.include?("vinograd") || t.include?("voćnjak") || t.include?("pašnjak") || t.include?("poljoprivred")
      "Zemljište"
    elsif t.include?("poslovn") || t.include?("zgrad") || t.include?("prostor") || t.include?("lokal") || t.include?("ured") || t.include?("skladišt") || t.include?("hala") || t.include?("radion")
      "Poslovni prostor"
    elsif t.include?("garaž") || t.include?("parkir")
      "Garaža"
    else
      "Ostalo"
    end
  end

  def self.extract_field(html, label)
    if html =~ /<strong>\s*#{Regexp.escape(label)}\s*<\/strong>(?:(?!<strong>).)*?<div class="col-md-9[^"]*"[^>]*>(.*?)<\/div>/m
      val = $1.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ").strip
      val.empty? ? nil : val
    else
      nil
    end
  end

  def self.fetch_all_active
    puts "[FINA Fetcher] Fetching list of announcements from FINA..."
    uri = URI("#{BASE_URL}/pregled/najava")
    req = Net::HTTP::Get.new(uri)
    req["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = 20

    res = http.request(req)
    unless res.is_a?(Net::HTTPSuccess)
      raise "Failed to fetch FINA najava: #{res.code} #{res.message}"
    end

    raw_items = JSON.parse(res.body)
    puts "[FINA Fetcher] Total items received: #{raw_items.length}"

    today = Date.today
    # Filter items: MUST NOT HAVE EXPIRED DEPOSIT DEADLINE
    active_items = raw_items.select do |item|
      if item["datValJamcevineFmt"]
        parts = item["datValJamcevineFmt"].strip.chomp(".").split(".")
        if parts.length == 3
          begin
            d = Date.new(parts[2].to_i, parts[1].to_i, parts[0].to_i)
            d >= today
          rescue
            true
          end
        else
          true
        end
      else
        true
      end
    end

    puts "[FINA Fetcher] Active items (deposit deadline >= today): #{active_items.length}"

    # Concurrent fetch of detail pages
    queue = Queue.new
    active_items.each { |item| queue << item }

    results = []
    mutex = Mutex.new
    thread_count = 16

    threads = thread_count.times.map do
      Thread.new do
        http_worker = Net::HTTP.new(uri.host, uri.port)
        http_worker.use_ssl = true
        http_worker.open_timeout = 8
        http_worker.read_timeout = 15

        while !queue.empty?
          item = nil
          begin
            item = queue.pop(true)
          rescue ThreadError
            break
          end
          next unless item

          uuid = item["uuid"]
          detail_uri = URI("#{BASE_URL}/predmet_prodaje/#{uuid}")
          detail_req = Net::HTTP::Get.new(detail_uri)
          detail_req["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

          begin
            detail_res = http_worker.request(detail_req)
            if detail_res.is_a?(Net::HTTPSuccess)
              html = detail_res.body.force_encoding("UTF-8")

              # Extract properties table
              props = []
              html.scan(/<tr[^>]*>(.*?)<\/tr>/m).each do |tr_match|
                tr = tr_match[0]
                next if tr.include?("<th")
                cells = []
                tr.scan(/<td[^>]*>(.*?)<\/td>/m).each do |td_match|
                  cells << td_match[0].gsub(/<[^>]+>/, "").gsub(/\s+/, " ").strip
                end
                props << cells if cells.length >= 7
              end

              # Map properties
              clean_props = props.map do |c|
                {
                  vrsta: c[1] || "",
                  katastarska_opcina: c[2] || "",
                  povrsina: c[3] || "",
                  naselje: c[4] || "",
                  adresa: c[5] || "",
                  suvlasnistvo: c[6] || "",
                  zk_ulozak: c[7] || "",
                  kat_cestica: c[8] || "",
                  zupanija: c[9] || "",
                  grad_opcina: c[10] || "",
                  postanski_broj: c[11] || "",
                  lat: c[12] && !c[12].empty? ? c[12].to_f : nil,
                  lng: c[13] && !c[13].empty? ? c[13].to_f : nil
                }
              end

              # Determine primary property
              primary_prop = clean_props.first || {}

              # Extract fields from detail HTML
              utvrdena_vrjd = extract_field(html, "Utvrđena vrijednost")
              min_cijena = extract_field(html, "Minimalna zakonska cijena")
              poc_cijena = extract_field(html, "Početna cijena za nadmetanje")
              jamcevina = extract_field(html, "Iznos jamčevine")
              rok_jamcevine = extract_field(html, "Rok za uplatu jamčevine") || item["datValJamcevineFmt"]
              korak = extract_field(html, "Iznos dražbenog koraka")
              rok_kupovnina = extract_field(html, "Rok u kojem je kupac dužan položiti kupovninu")
              razgledavanje = extract_field(html, "Razgledavanje")
              posl_br = extract_field(html, "Poslovni broj") || item["poslBrSpisa"]
              sud = extract_field(html, "Nadležno tijelo") || item["nazIzd"]
              nacin_prodaje = extract_field(html, "Način prodaje") || item["nazivNacProdaje"]
              
              # Description
              opis = ""
              if html =~ /class="opis-pp"[^>]*>(.*?)<\/p>/m
                opis = $1.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ").strip
              end

              # Determine normalized county
              raw_zup = primary_prop[:zupanija]
              if raw_zup.nil? || raw_zup.empty?
                clean_props.each do |p|
                  if p[:zupanija] && !p[:zupanija].empty?
                    raw_zup = p[:zupanija]
                    break
                  end
                end
              end

              grad_name = primary_prop[:grad_opcina]
              grad_name = primary_prop[:naselje] if grad_name.nil? || grad_name.empty?

              normalized_county = normalize_county(raw_zup, sud, grad_name)
              primary_type = categorize_type(primary_prop[:vrsta])

              # Calculate days remaining for jamcevina
              days_remaining = nil
              if rok_jamcevine
                parts = rok_jamcevine.strip.chomp(".").split(".")
                if parts.length == 3
                  begin
                    deadline_date = Date.new(parts[2].to_i, parts[1].to_i, parts[0].to_i)
                    days_remaining = (deadline_date - today).to_i
                  rescue
                  end
                end
              end

              parsed_item = {
                idNdmt: item["idNdmt"],
                uuid: uuid,
                poslovniBroj: posl_br,
                sud: sud,
                nacinProdaje: nacin_prodaje,
                pocetnaCijena: item["pocCijenaNdmt"],
                pocetnaCijenaFmt: poc_cijena || (item["pocCijenaNdmtFmt"] ? item["pocCijenaNdmtFmt"].first : "#{item["pocCijenaNdmt"]} EUR"),
                utvrdenaVrijednost: utvrdena_vrjd,
                iznosJamcevine: jamcevina,
                rokJamcevine: rok_jamcevine,
                preostaloDanaJamcevina: days_remaining,
                drazbeniKorak: korak,
                rokKupovnine: rok_kupovnina,
                pocetakDrazbe: item["pocNdmtFmt"],
                zavrsetakDrazbe: item["zavNdmtFmt"],
                brojUplatitelja: item["brUplatitelja"] || 0,
                razgledavanje: razgledavanje,
                opis: opis,
                zupanija: normalized_county,
                glavnaVrsta: primary_type,
                glavniGrad: grad_name || "Nepoznato",
                glavnaAdresa: primary_prop[:adresa] || "",
                glavnaPovrsina: primary_prop[:povrsina] || "",
                lat: primary_prop[:lat],
                lng: primary_prop[:lng],
                nekretnine: clean_props,
                finaUrl: "#{BASE_URL}/predmet_prodaje/#{uuid}",
                pismenaUrl: "https://ponip.fina.hr/javnaobjava-web/pretrazivanje/pismena?pp=#{uuid}"
              }

              mutex.synchronize do
                results << parsed_item
                print "\r[FINA Fetcher] Processed: #{results.length}/#{active_items.length}"
                $stdout.flush
              end
            end
          rescue => e
            # Ignore individual fetch failure
          end
        end
      end
    end

    threads.each(&:join)
    puts "\n[FINA Fetcher] Finished! Total active parsed: #{results.length}"

    # Sort: nearest jamcevina deadline first
    results.sort_by! { |r| r[:preostaloDanaJamcevina] || 9999 }

    results
  end

  def self.save_to_file(data_dir = File.expand_path("data", __dir__))
    Dir.mkdir(data_dir) unless Dir.exist?(data_dir)

    listings = fetch_all_active

    # Aggregate counts by county and type
    counties_counts = Hash.new(0)
    types_counts = Hash.new(0)

    listings.each do |l|
      counties_counts[l[:zupanija]] += 1
      types_counts[l[:glavnaVrsta]] += 1
    end

    metadata = {
      last_updated_at: Time.now.strftime("%d.%m.%Y. %H:%M"),
      total_count: listings.length,
      counties: counties_counts.sort_by { |_, v| -v }.to_h,
      types: types_counts.sort_by { |_, v| -v }.to_h
    }

    File.write(File.join(data_dir, "listings.json"), JSON.pretty_generate(listings))
    File.write(File.join(data_dir, "status.json"), JSON.pretty_generate(metadata))

    # Also mirror into public/data for static deployments
    public_data = File.expand_path("public/data", __dir__)
    if Dir.exist?(File.expand_path("public", __dir__))
      Dir.mkdir(public_data) unless Dir.exist?(public_data)
      File.write(File.join(public_data, "listings.json"), JSON.pretty_generate(listings))
      File.write(File.join(public_data, "status.json"), JSON.pretty_generate(metadata))
    end

    puts "[FINA Fetcher] Data successfully written to #{data_dir}/listings.json"
    metadata
  end
end

if __FILE__ == $0
  FinaFetcher.save_to_file
end
