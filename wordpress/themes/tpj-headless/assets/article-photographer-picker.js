/**
 * Photographer picker — wires the meta box on essay/interview/feature
 * edit screens. Reads its initial state from data attributes on the
 * container (server-rendered), queries the REST search endpoint as
 * the editor types, lets them select/deselect by click. Selected IDs
 * round-trip through a hidden input that the save handler in
 * inc/photographer-admin.php reads on form submit.
 *
 * Pure vanilla JS, no framework. Runs once on DOMContentLoaded and
 * hydrates every .tpj-picker container found on the page (only one
 * in practice, but the structure tolerates multiple).
 */
(function () {
	"use strict";

	function init() {
		var containers = document.querySelectorAll(".tpj-picker");
		for (var i = 0; i < containers.length; i++) {
			initPicker(containers[i]);
		}
	}

	function initPicker(container) {
		var initial = safeJSON(container.dataset.initial, []);
		var restUrl = container.dataset.restUrl;
		var restNonce = container.dataset.restNonce;
		var hiddenInput = container.querySelector('input[name="tpj_photographer_ids"]');
		var chipsEl = container.querySelector(".tpj-picker-chips");
		var emptyEl = container.querySelector(".tpj-picker-empty");
		var searchInput = container.querySelector(".tpj-picker-search-input");
		var resultsEl = container.querySelector(".tpj-picker-results");

		// Local state: the ordered list of selected photographer objects.
		// We keep full objects (not just IDs) so we can render chips
		// without re-fetching, and so removals from local state are
		// instant.
		var selected = initial.slice();

		function syncHidden() {
			var ids = selected.map(function (p) {
				return p.id;
			});
			hiddenInput.value = JSON.stringify(ids);
		}

		function renderChips() {
			chipsEl.innerHTML = "";
			if (selected.length === 0) {
				if (emptyEl) emptyEl.hidden = false;
			} else if (emptyEl) {
				emptyEl.hidden = true;
			}

			selected.forEach(function (p, idx) {
				var chip = document.createElement("div");
				chip.className = "tpj-picker-chip";
				chip.dataset.index = String(idx);

				// Portrait (or initials fallback)
				var portrait = document.createElement("span");
				portrait.className = "tpj-picker-chip-avatar";
				if (p.portrait) {
					var img = document.createElement("img");
					img.src = p.portrait;
					img.alt = "";
					portrait.appendChild(img);
				} else {
					portrait.textContent = initials(p.name);
				}
				chip.appendChild(portrait);

				// Name + slug
				var label = document.createElement("span");
				label.className = "tpj-picker-chip-label";
				var name = document.createElement("strong");
				name.textContent = decodeEntities(p.name);
				var slug = document.createElement("span");
				slug.className = "tpj-picker-chip-slug";
				slug.textContent = p.slug;
				label.appendChild(name);
				label.appendChild(slug);
				chip.appendChild(label);

				// Remove button
				var rm = document.createElement("button");
				rm.type = "button";
				rm.className = "tpj-picker-chip-remove";
				rm.setAttribute("aria-label", "Remove " + decodeEntities(p.name));
				rm.textContent = "×";
				rm.addEventListener("click", function () {
					selected.splice(idx, 1);
					renderChips();
					syncHidden();
				});
				chip.appendChild(rm);

				chipsEl.appendChild(chip);
			});

			syncHidden();
		}

		// Debounced search. 200ms is the sweet spot — fast enough that
		// the editor feels responsive, slow enough that they're not
		// firing a request on every keystroke.
		var searchTimer = null;
		searchInput.addEventListener("input", function () {
			clearTimeout(searchTimer);
			var q = searchInput.value.trim();
			searchTimer = setTimeout(function () {
				doSearch(q);
			}, 200);
		});

		// Focus handler: if the field has content but no results
		// rendered yet (e.g. editor tabbed away and back), re-run.
		searchInput.addEventListener("focus", function () {
			if (resultsEl.children.length === 0) {
				doSearch(searchInput.value.trim());
			}
		});

		// Click outside the results closes the dropdown.
		document.addEventListener("click", function (e) {
			if (!container.contains(e.target)) {
				resultsEl.hidden = true;
			}
		});

		function doSearch(q) {
			var url = restUrl + (q ? "?q=" + encodeURIComponent(q) : "");
			fetch(url, {
				headers: { "X-WP-Nonce": restNonce },
				credentials: "same-origin",
			})
				.then(function (res) {
					return res.json();
				})
				.then(function (data) {
					renderResults(Array.isArray(data) ? data : []);
				})
				.catch(function () {
					renderResults([]);
				});
		}

		function renderResults(results) {
			resultsEl.innerHTML = "";

			// Filter out anything already selected so the editor doesn't
			// see duplicates of their current credits in the dropdown.
			var selectedIds = {};
			selected.forEach(function (p) {
				selectedIds[p.id] = true;
			});
			var filtered = results.filter(function (r) {
				return !selectedIds[r.id];
			});

			if (filtered.length === 0) {
				resultsEl.hidden = true;
				return;
			}

			filtered.forEach(function (p) {
				var row = document.createElement("button");
				row.type = "button";
				row.className = "tpj-picker-result";
				row.dataset.id = String(p.id);

				// Portrait
				var portrait = document.createElement("span");
				portrait.className = "tpj-picker-result-avatar";
				if (p.portrait) {
					var img = document.createElement("img");
					img.src = p.portrait;
					img.alt = "";
					portrait.appendChild(img);
				} else {
					portrait.textContent = initials(p.name);
				}
				row.appendChild(portrait);

				// Name + slug (top line) and count + location (bottom line)
				var label = document.createElement("span");
				label.className = "tpj-picker-result-label";

				var topLine = document.createElement("span");
				topLine.className = "tpj-picker-result-top";
				var name = document.createElement("strong");
				name.textContent = decodeEntities(p.name);
				topLine.appendChild(name);
				var slugSpan = document.createElement("span");
				slugSpan.className = "tpj-picker-result-slug";
				slugSpan.textContent = p.slug;
				topLine.appendChild(slugSpan);
				label.appendChild(topLine);

				var bottomLine = document.createElement("span");
				bottomLine.className = "tpj-picker-result-bottom";
				var parts = [];
				if (p.article_count > 0) {
					parts.push(
						p.article_count +
							" article" +
							(p.article_count === 1 ? "" : "s")
					);
				}
				if (p.location) parts.push(p.location);
				bottomLine.textContent = parts.join(" · ");
				if (parts.length > 0) label.appendChild(bottomLine);

				row.appendChild(label);

				row.addEventListener("click", function () {
					selected.push(p);
					renderChips();
					searchInput.value = "";
					resultsEl.innerHTML = "";
					resultsEl.hidden = true;
					searchInput.focus();
				});

				resultsEl.appendChild(row);
			});

			resultsEl.hidden = false;
		}

		// Initial render
		renderChips();
	}

	function safeJSON(str, fallback) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return fallback;
		}
	}

	// Decode HTML entities (post titles come through the REST endpoint
	// containing things like "Anais &amp; Dax"). textContent assignment
	// alone doesn't decode — we route via a one-off DOM element.
	var decoder = document.createElement("textarea");
	function decodeEntities(s) {
		decoder.innerHTML = String(s);
		return decoder.value;
	}

	function initials(name) {
		var trimmed = String(name).trim();
		if (!trimmed) return "?";
		var parts = trimmed.split(/\s+/).filter(function (p) {
			return /[A-Za-z]/.test(p);
		});
		if (parts.length === 0) return trimmed.charAt(0).toUpperCase();
		if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
		return (
			parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
		).toUpperCase();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
