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
		// Support both the new split urls (search + create) and the
		// legacy single rest-url attribute, in case the meta box is
		// re-rendered from a cached page.
		var searchUrl = container.dataset.searchUrl || container.dataset.restUrl;
		var createUrl =
			container.dataset.createUrl ||
			(searchUrl ? searchUrl.replace(/\/search(\?.*)?$/, "/create") : "");
		var restNonce = container.dataset.restNonce;
		var hiddenInput = container.querySelector('input[name="tpj_photographer_ids"]');
		var chipsEl = container.querySelector(".tpj-picker-chips");
		var emptyEl = container.querySelector(".tpj-picker-empty");
		var searchInput = container.querySelector(".tpj-picker-search-input");
		var resultsEl = container.querySelector(".tpj-picker-results");

		// Inline "Add new" form. Optional — the picker degrades to
		// search-only if the form markup is missing.
		var addToggle = container.querySelector(".tpj-picker-add-new-toggle");
		var formEl = container.querySelector(".tpj-picker-form");
		var nameInput = container.querySelector(".tpj-picker-form-name");
		var bioInput = container.querySelector(".tpj-picker-form-bio");
		var websiteInput = container.querySelector(".tpj-picker-form-website");
		var instagramInput = container.querySelector(".tpj-picker-form-instagram");
		var submitBtn = container.querySelector(".tpj-picker-form-submit");
		var cancelBtn = container.querySelector(".tpj-picker-form-cancel");
		var suggestionEl = container.querySelector(".tpj-picker-form-suggestion");
		var errorEl = container.querySelector(".tpj-picker-form-error");

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
			var url = searchUrl + (q ? "?q=" + encodeURIComponent(q) : "");
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

		// ---------- Inline create form ----------

		function openForm(prefillName) {
			if (!formEl) return;
			formEl.hidden = false;
			if (addToggle) addToggle.hidden = true;
			if (errorEl) errorEl.hidden = true;
			if (suggestionEl) suggestionEl.hidden = true;
			if (nameInput) {
				nameInput.value = prefillName || searchInput.value || "";
				nameInput.focus();
				checkDupe(nameInput.value);
			}
		}

		function closeForm() {
			if (!formEl) return;
			formEl.hidden = true;
			if (addToggle) addToggle.hidden = false;
			if (nameInput) nameInput.value = "";
			if (bioInput) bioInput.value = "";
			if (websiteInput) websiteInput.value = "";
			if (instagramInput) instagramInput.value = "";
			if (errorEl) {
				errorEl.hidden = true;
				errorEl.textContent = "";
			}
			if (suggestionEl) {
				suggestionEl.hidden = true;
				suggestionEl.innerHTML = "";
			}
		}

		// Debounced duplicate check on the name field: if any existing
		// photographer's slug matches sanitize_title(typed_name), surface
		// it as a "Did you mean…?" suggestion so the editor can pick the
		// existing record instead of creating a near-duplicate.
		var dupeTimer = null;
		function checkDupe(query) {
			if (!suggestionEl) return;
			clearTimeout(dupeTimer);
			var q = (query || "").trim();
			if (q.length < 2) {
				suggestionEl.hidden = true;
				suggestionEl.innerHTML = "";
				return;
			}
			dupeTimer = setTimeout(function () {
				var url = searchUrl + "?q=" + encodeURIComponent(q) + "&limit=3";
				fetch(url, {
					headers: { "X-WP-Nonce": restNonce },
					credentials: "same-origin",
				})
					.then(function (res) {
						return res.json();
					})
					.then(function (data) {
						renderSuggestion(Array.isArray(data) ? data : []);
					})
					.catch(function () {});
			}, 250);
		}

		function renderSuggestion(matches) {
			if (!suggestionEl) return;
			if (!matches.length) {
				suggestionEl.hidden = true;
				suggestionEl.innerHTML = "";
				return;
			}
			suggestionEl.innerHTML = "";
			var header = document.createElement("p");
			header.className = "tpj-picker-form-suggestion-header";
			header.textContent =
				matches.length === 1
					? "Did you mean this photographer?"
					: "Some existing photographers match. Use one instead of creating a duplicate?";
			suggestionEl.appendChild(header);

			matches.forEach(function (p) {
				if (selected.some(function (s) { return s.id === p.id; })) return;
				var btn = document.createElement("button");
				btn.type = "button";
				btn.className = "tpj-picker-form-suggestion-item";
				btn.innerHTML =
					"<strong></strong><span></span>";
				btn.querySelector("strong").textContent = decodeEntities(p.name);
				btn.querySelector("span").textContent =
					p.slug +
					(p.article_count
						? " · " +
							p.article_count +
							" article" +
							(p.article_count === 1 ? "" : "s")
						: "");
				btn.addEventListener("click", function () {
					selected.push(p);
					renderChips();
					closeForm();
				});
				suggestionEl.appendChild(btn);
			});

			suggestionEl.hidden = false;
		}

		function submitForm() {
			if (!nameInput || !nameInput.value.trim()) {
				showError("Name is required.");
				if (nameInput) nameInput.focus();
				return;
			}
			submitBtn.disabled = true;
			if (errorEl) errorEl.hidden = true;

			var payload = {
				name: nameInput.value.trim(),
				bio: bioInput ? bioInput.value : "",
				website: websiteInput ? websiteInput.value.trim() : "",
				instagram: instagramInput ? instagramInput.value.trim() : "",
			};

			fetch(createUrl, {
				method: "POST",
				headers: {
					"X-WP-Nonce": restNonce,
					"Content-Type": "application/json",
				},
				credentials: "same-origin",
				body: JSON.stringify(payload),
			})
				.then(function (res) {
					return res.json().then(function (body) {
						return { status: res.status, body: body };
					});
				})
				.then(function (result) {
					submitBtn.disabled = false;
					if (result.status === 201) {
						selected.push(result.body);
						renderChips();
						closeForm();
						return;
					}
					if (
						result.status === 409 &&
						result.body &&
						result.body.data &&
						result.body.data.existing
					) {
						// Server-side duplicate: offer to use the existing
						// record directly.
						var existing = result.body.data.existing;
						showError(
							"A photographer named “" +
								decodeEntities(existing.name) +
								"” already exists."
						);
						renderSuggestion([
							{
								id: existing.id,
								name: existing.name,
								slug: existing.slug,
								portrait: null,
								location: null,
								atomic_combo: false,
								article_count: 0,
							},
						]);
						return;
					}
					var msg =
						(result.body && result.body.message) ||
						"Couldn’t create photographer. Try again or use search.";
					showError(msg);
				})
				.catch(function () {
					submitBtn.disabled = false;
					showError("Network error. Check your connection and retry.");
				});
		}

		function showError(message) {
			if (!errorEl) return;
			errorEl.textContent = message;
			errorEl.hidden = false;
		}

		if (addToggle) {
			addToggle.addEventListener("click", function () {
				openForm(searchInput.value || "");
			});
		}
		if (cancelBtn) {
			cancelBtn.addEventListener("click", closeForm);
		}
		if (submitBtn) {
			submitBtn.addEventListener("click", submitForm);
		}
		if (nameInput) {
			nameInput.addEventListener("input", function () {
				checkDupe(nameInput.value);
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
