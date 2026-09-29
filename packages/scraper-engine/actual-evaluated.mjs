(function() {
        var blockedDomains = ["google.com","www.google.com","g.page","maps.google.com","w3.org","schema.org","facebook.com","twitter.com","instagram.com","linkedin.com","youtube.com"];
        var blockedSet = new Set(blockedDomains);
        var cards = [];
        var seen = new Set();

      var extractPlaceId = function(href, card) {
        var ftidMatch = href.match(/[!?&]ftid=([^!&]+)/);
        if (ftidMatch && ftidMatch[1]) return decodeURIComponent(ftidMatch[1]);

        var dataMatch = href.match(/!1s([^!]+)!/);
        if (dataMatch && dataMatch[1]) {
          var raw = dataMatch[1].replace(/%20/g, "+");
          if (raw.length >= 27) return raw;
        }

        var hexMatch = href.match(/0x[0-9a-fA-F]+:0x[0-9a-fA-F]+/);
        if (hexMatch) return hexMatch[0];

        if (card instanceof HTMLElement) {
          var resultId = card.getAttribute("data-result-id");
          if (resultId) return resultId;
          var inner = card.querySelector("[data-result-id]");
          if (inner && inner.getAttribute("data-result-id")) return inner.getAttribute("data-result-id");
        }

        var pathMatch = href.match(/\\/place\\/([^/@?#]+)/);
        if (pathMatch && pathMatch[1]) return pathMatch[1];

        return "";
      };

      var cleanName = function(raw) {
        if (!raw) return "";
        var name = raw.replace(/^\\s*\\d+(?:\\.\\d+)?\\s*\\(?\\d[\\d,]*\\)?\\s*/, "");
        name = name.replace(/·.*$/, "").trim();
        name = name.replace(/\\s*Open\\s+\\d.*$/i, "").trim();
        name = name.replace(/\\s*\\s*/g, "").trim();
        return name;
      };

      var parseAbbreviatedNumber = function(str) {
        var s = str.replace(/,/g, "").trim();
        var num = parseFloat(s);
        if (isNaN(num)) return 0;
        if (/[Kk]/.test(s)) num *= 1000;
        else if (/[Mm]/.test(s)) num *= 1000000;
        else if (/[Bb]/.test(s)) num *= 1000000000;
        return Math.round(num);
      };

      var extractRatingStars = function(card) {
        var rating = null;
        var reviewCount = null;
        var cardText = card.textContent || "";

        // 1. Dedicated ARIA review label (e.g. <span role="img" aria-label="42 reviews">)
        var reviewEls = card.querySelectorAll('[aria-label*="review" i], [role="img"][aria-label*="review" i]');
        for (var ri = 0; ri < reviewEls.length; ri++) {
          var rl = (reviewEls[ri].getAttribute("aria-label") || "").trim();
          var rn = rl.match(/^([\\d,]+\.?[\\d]*[KkMmBb]?)\\s*(?:reviews?|ratings?)/i);
          if (rn && rn[1]) {
            var p = parseAbbreviatedNumber(rn[1]);
            if (p > 0 && p < 10000000) { reviewCount = p; break; }
          }
        }

        // 2. ARIA rating label (combined or dedicated)
        var starEl = card.querySelector('[aria-label*="star" i], [role="img"][aria-label*="star" i]');
        if (starEl) {
          var sl = starEl.getAttribute("aria-label") || "";
          var sm = sl.match(/(\\d+(?:\\.\\d+)?)\\s*(?:star|stars)/i);
          if (sm && sm[1]) {
            var pr = parseFloat(sm[1]);
            if (pr > 0 && pr <= 5.0) rating = pr;
          }
          if (reviewCount === null) {
            var rs = sl.match(/([\\d,]+\.?[\\d]*[KkMmBb]?)\\s*(?:reviews?|ratings?)/i);
            if (rs && rs[1]) {
              var p2 = parseAbbreviatedNumber(rs[1]);
              if (p2 > 0 && p2 < 10000000) reviewCount = p2;
            }
          }
        }

        // 3. Text pattern fallback (only for fields still missing)
        if (rating === null || reviewCount === null) {

          // 3a. Combined: "5.0 · 1.2K reviews" or "5.0 (42)"
          var cm = cardText.match(/(\\d+(?:\\.\\d+)?)\\s*[·•]\\s*([\\d,]+\.?[\\d]*[KkMmBb]?)\\s*(?:reviews?|ratings?)?/);
          if (!cm) {
            cm = cardText.match(/(\\d+(?:\\.\\d+)?)\\s*\\(([\\d,]+\.?[\\d]*[KkMmBb]?)\\)/);
          }
          if (cm) {
            if (rating === null && cm[1]) {
              var p3 = parseFloat(cm[1]);
              if (p3 > 0 && p3 <= 5.0) rating = p3;
            }
            if (reviewCount === null && cm[2]) {
              var p4 = parseAbbreviatedNumber(cm[2]);
              if (p4 > 0 && p4 < 10000000) reviewCount = p4;
            }
          }

          // 3b. Parentheses only: (42) or (1.2K)
          if (reviewCount === null) {
            var pm = cardText.match(/\\(([\\d,]+\.?[\\d]*[KkMmBb]?)\\)/);
            if (pm && pm[1]) {
              var p5 = parseAbbreviatedNumber(pm[1]);
              if (p5 > 0 && p5 < 10000000) reviewCount = p5;
            }
          }

          // 3c. Middle-dot / bullet separated
          if (reviewCount === null) {
            var dm = cardText.match(/[·•]\\s*([\\d,]+\.?[\\d]*[KkMmBb]?)\\s*(?:reviews?|ratings?)?/i);
            if (dm && dm[1]) {
              var p6 = parseAbbreviatedNumber(dm[1]);
              if (p6 > 0 && p6 < 10000000) reviewCount = p6;
            }
          }

          // 3d. Word-anchored: "42 reviews" / "1.2K ratings"
          if (reviewCount === null) {
            var wm = cardText.match(/([\\d,]+\.?[\\d]*[KkMmBb]?)\\s+(?:reviews?|ratings?)/i);
            if (wm && wm[1]) {
              var p7 = parseAbbreviatedNumber(wm[1]);
              if (p7 > 0 && p7 < 10000000) reviewCount = p7;
            }
          }

          // 3e. Rating in text
          if (rating === null) {
            var tm = cardText.match(/(\\d+(?:\\.\\d+)?)\\s*(?:star|stars)/i);
            if (tm && tm[1]) {
              var p8 = parseFloat(tm[1]);
              if (p8 > 0 && p8 <= 5.0) rating = p8;
            }
          }
        }

        return { rating: rating, reviewCount: reviewCount };
      };

      var extractAddress = function(text) {
        if (!text) return "";
        var parts = text.split("·");
        for (var i = 0; i < parts.length; i++) {
          var part = (parts[i] || "").trim();
          if (!part) continue;

          var lowerPart = part.toLowerCase();
          if (lowerPart.indexOf("open") === 0 || lowerPart.indexOf("closed") === 0 ||
              lowerPart.indexOf("temporarily closed") === 0 || lowerPart.indexOf("permanently closed") === 0) {
            part = part.replace(/\b(Open|Closed|Open 24 hours|Closed ⋅ Opens.*|Temporarily closed|Permanently closed)\b/gi, "").trim();
          }

          var cleaned = part.replace(/Open\s+\d.*$/i, "").trim();
          if (cleaned.length > 8 && /\d{1,6}\s+[A-Z]/.test(cleaned)) {
            var striped = cleaned.replace(/^[^a-zA-Z\d]*\d+\.?\d*\s*/, "");
            var m = striped.match(/(\d+[^,]{3,120}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Highway|Hwy|Loop|Square|Sq|Bend|Row|Alley)[^,\n]{0,80}(?:,\s*[A-Z]{2}\s*\d{5})?)/i);
            if (m && m[1]) return m[1].trim();
            var sepIdx = striped.indexOf("·");
            if (sepIdx > 0) return striped.substring(0, sepIdx).trim();
            return striped.trim();
          }
        }
        return "";
      };

      var extractPhone = function(text) {
        var phoneMatch = text.match(/(?:\\+?1[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/);
        return phoneMatch ? phoneMatch[0] : "";
      };

      var extractWebsite = function(card) {
        if (!(card instanceof HTMLElement)) return "";

        var websiteLinks = card.querySelectorAll('a[data-value="Website"], a[aria-label*="Website"], a[aria-label*="website"]');
        for (var i = 0; i < websiteLinks.length; i++) {
          var raw = websiteLinks[i].href;
          if (!raw) continue;
          try {
            var host = new URL(raw).hostname;
            if (!raw.includes("google.com/maps") && !raw.includes("g.page") && !blockedSet.has(host)) {
              return raw;
            }
          } catch (e) { continue; }
        }

        var allLinks = card.querySelectorAll("a[href]");
        for (var j = 0; j < allLinks.length; j++) {
          var raw2 = allLinks[j].href;
          if (!raw2 || raw2.includes("google.com/maps") || raw2.includes("g.page") || raw2.includes("youtube.com")) continue;
          try {
            var host2 = new URL(raw2).hostname;
            if (!blockedSet.has(host2)) return raw2;
          } catch (e) { continue; }
        }
        return "";
      };

      var extractCategory = function(text) {
        var subs = [];
        var catMatch = text.match(/(?:Real Estate Agent|Brokerage|Property Manager|Real Estate Agency|Real Estate|Mortgage|Insurance|Title Company|Home Builder|Appraiser|Home Inspector|Real Estate Attorney|Real Estate Consultant|Real Estate Developer)/gi);
        if (catMatch) {
          var main = catMatch[0];
          for (var i = 1; i < catMatch.length; i++) {
            if (catMatch[i]) subs.push(catMatch[i]);
          }
          var uniqueSubs = [];
          var subSeen = {};
          for (var k = 0; k < subs.length; k++) {
            if (!subSeen[subs[k]]) { subSeen[subs[k]] = true; uniqueSubs.push(subs[k]); }
          }
          return { main: main, subs: uniqueSubs };
        }
        return { main: "", subs: [] };
      };

      var feed = document.querySelector('div[role="feed"]');
      var container = feed || document;

      var placeLinks = container.querySelectorAll('a[href*="/maps/place/"]');

      for (var li = 0; li < placeLinks.length; li++) {
        var link = placeLinks[li];
        var href = link.getAttribute("href") || "";
        if (!href) continue;

        var card = link.closest('[role="article"], [data-result-id]') || link.parentElement || link;
        var placeId = extractPlaceId(link.href, card);
        if (!placeId || seen.has(placeId)) continue;
        seen.add(placeId);

        var fullHref = link.href || ("https://www.google.com" + href);
        var ariaLabel = (link.getAttribute("aria-label") || "").trim();

        var text = card.textContent || "";

        var name = cleanName(ariaLabel);
        if (!name && card instanceof HTMLElement) {
          var heading = card.querySelector('div[class*="fontHeadline"], span[class*="fontHeadline"], h1, h2, h3, [class*="title"]');
          name = heading ? (heading.textContent || "").trim() : "";
          name = cleanName(name);
        }
        if (!name) {
          var lines = text.split("\\n");
          var firstLine = "";
          for (var fl = 0; fl < lines.length; fl++) {
            if (lines[fl].trim().length > 2) { firstLine = lines[fl].trim(); break; }
          }
          name = cleanName(firstLine);
        }
        if (name.length > 120) name = name.slice(0, 120);

        var ratingData = extractRatingStars(card);
        var address = extractAddress(text);
        var phone = extractPhone(text);
        var website = extractWebsite(card);
        var catData = extractCategory(text);

        cards.push({
          name: name,
          placeId: placeId,
          mapsLink: fullHref,
          address: address,
          phone: phone,
          website: website,
          rating: ratingData.rating,
          reviewCount: ratingData.reviewCount,
          mainCategory: catData.main,
          subcategories: catData.subs,
        });
      }

      return cards;
    })()