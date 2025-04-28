document.addEventListener("DOMContentLoaded", function () {
  const appNameLink = document.querySelector(".app-name-link");
  if (appNameLink) {
    appNameLink.setAttribute("href", "https://docs.spot.io");
  }
});

(function () {
  function storeSearchTermOnInput() {
    const searchInput = document.querySelector('.sidebar input[type="search"]');
    if (!searchInput) {
      console.error("Search input not found!");
      return;
    }

    function saveSearchTerm() {
      const searchTerm = searchInput.value.trim();
      if (searchTerm) {
        sessionStorage.setItem("highlightSearchTerm", searchTerm);
      } else {
        sessionStorage.removeItem("highlightSearchTerm");
      }
    }

    searchInput.addEventListener("input", saveSearchTerm);
    searchInput.addEventListener("blur", saveSearchTerm);
  }

  function highlightStoredSearchTerm() {
    let fromSearch = sessionStorage.getItem("fromSearchResult");
    let searchTerm = sessionStorage.getItem("highlightSearchTerm");

    const urlParams = new URLSearchParams(window.location.search);
    if ((!fromSearch || !searchTerm) && urlParams.get("fromSearch") === "1" && urlParams.get("term")) {
      fromSearch = "true";
      searchTerm = urlParams.get("term");
      sessionStorage.setItem("fromSearchResult", "true");
      sessionStorage.setItem("highlightSearchTerm", searchTerm);
    }

    if (!fromSearch || !searchTerm) return;

    const content = document.querySelector(".markdown-section");
    if (!content) return;

    const regex = new RegExp(`(${searchTerm})`, "gi");

    function wrapMatches(node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
        if (!node.parentNode || !node.parentNode.classList.contains("highlight")) {
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;

          node.nodeValue.replace(regex, (match, p1, offset) => {
            fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, offset)));
            const span = document.createElement("span");
            span.className = "highlight";
            span.textContent = p1;
            fragment.appendChild(span);
            lastIndex = offset + p1.length;
          });

          fragment.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
          return fragment;
        }
      }

      const clonedNode = node.cloneNode(false);
      for (const child of node.childNodes) {
        clonedNode.appendChild(wrapMatches(child));
      }
      return clonedNode;
    }

    content.querySelectorAll(".highlight").forEach((el) => {
      el.replaceWith(document.createTextNode(el.textContent));
    });

    const nodes = [...content.childNodes];
    for (const node of nodes) {
      content.replaceChild(wrapMatches(node), node);
    }

    content.querySelectorAll(".highlight").forEach((el) => {
      const detailsParent = el.closest("details");
      if (detailsParent) {
        detailsParent.setAttribute("open", "");
      }
    });

    if (window.history.replaceState) {
      const cleanURL = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", cleanURL);
    }

    sessionStorage.removeItem("fromSearchResult");
  }

  function customHighlightPlugin(hook) {
    hook.doneEach(() => {
      setTimeout(highlightStoredSearchTerm, 500);
    });
  }

  window.$docsify.plugins = [].concat(
    customHighlightPlugin,
    window.$docsify.plugins || []
  );

  document.addEventListener("DOMContentLoaded", storeSearchTermOnInput);
})();


// PAGINATION SEARCH OVERLAY

document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector(".sidebar");
  const mainPanel = document.querySelector(".content article");
  const searchInput = sidebar ? sidebar.querySelector('input[type="search"]') : null;
  const clearButton = sidebar ? sidebar.querySelector(".clear-button") : null;

  let isSearchActive = false;
  const overlay = document.createElement("div");
  overlay.id = "search-overlay";
  document.body.appendChild(overlay);

  const RESULTS_PER_PAGE = 20;
  let currentPage = 1;
  let fullSearchResults = [];

  if (!sidebar || !mainPanel || !searchInput) {
    console.error("Required elements are missing: sidebar, content, or search input.");
    return;
  }

  function generatePaginationControls(totalPages) {
    let pages = '';
    const maxVisible = 10;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    return `
      <div class="pagination-controls">
        <button class="prev-page" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        ${pages}
        ${end < totalPages ? '<span>...</span>' : ''}
        <button class="next-page" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
      </div>
    `;
  }

  function updateSearchResults() {
    const resultCount = fullSearchResults.length;
    const totalPages = Math.ceil(resultCount / RESULTS_PER_PAGE);

    if (resultCount === 0) return;

    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    const start = (currentPage - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const pageResults = fullSearchResults.slice(start, end);

    const resultsHTML = pageResults.map(post => {
      const cleanUrl = post.url.split('?')[0];
      return `
        <div class="matching-post">
          <a href="${post.url}"><h2>${post.title}</h2></a>
          <p><a href="${post.url}">${post.content}</a></p>
          <p><small><a href="${post.url}">${cleanUrl}</a></small></p>
        </div>
      `;
    }).join('');

    const paginationControls = generatePaginationControls(totalPages);

    const searchResultsContent = `
      <div id="search-results">
        <button id="close-search-results" class="spot-btn pink">Close results</button>
        <h1>Search results (${resultCount} ${resultCount === 1 ? "result" : "results"})</h1>
        ${resultsHTML}
        ${paginationControls}
      </div>
    `;

    overlay.innerHTML = searchResultsContent;
    overlay.style.display = "block";
    isSearchActive = true;

    bindPaginationControls();
  }

  function bindPaginationControls() {
    overlay.querySelectorAll('.page-number').forEach(button => {
      button.addEventListener('click', function (e) {
        e.preventDefault();
        currentPage = parseInt(this.dataset.page);
        updateSearchResults();
      });
    });

    const nextBtn = overlay.querySelector('.next-page');
    const prevBtn = overlay.querySelector('.prev-page');

    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        currentPage++;
        updateSearchResults();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        currentPage--;
        updateSearchResults();
      });
    }
  }

  function closeOverlayAndResetSearch() {
    overlay.style.display = "none";
    isSearchActive = false;

    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }

    if (clearButton) {
      clearButton.classList.remove("show");
    }
  }

  function collectSearchResults() {
    const panel = sidebar.querySelector(".results-panel.show");
    if (!panel) return [];

    return Array.from(panel.querySelectorAll(".matching-post")).map(el => {
      const anchor = el.querySelector("a");
      const title = el.querySelector("h2")?.textContent || "";
      const content = el.querySelector("p a")?.textContent || "";
      return {
        url: anchor?.getAttribute("href") || "#",
        title: title,
        content: content
      };
    });
  }

  const sidebarObserver = new MutationObserver(function () {
    const panel = sidebar.querySelector(".results-panel.show");
    if (panel) {
      fullSearchResults = collectSearchResults();
      currentPage = 1;
      updateSearchResults();
    }
  });

  sidebarObserver.observe(sidebar, {
    childList: true,
    subtree: true,
  });

  searchInput.addEventListener("input", function (event) {
    currentPage = 1;
    const query = event.target.value.trim();
    if (!query) {
      overlay.style.display = "none";
      isSearchActive = false;
    }
  });

  sidebar.addEventListener("click", function (event) {
    const target = event.target.closest("a");
    if (target && isSearchActive) {
      overlay.style.display = "none";
      isSearchActive = false;

      const linkHref = target.getAttribute("href");
      if (linkHref) {
        window.location.href = linkHref;
      }
    }
  });

  const nativeCloseButton = sidebar.querySelector(".clear-button");
  if (nativeCloseButton) {
    nativeCloseButton.addEventListener("click", function (event) {
      event.stopPropagation();
      closeOverlayAndResetSearch();
    });
  }
});

(function () {
  function customPlugins(hook) {
    hook.doneEach(function () {
      document.addEventListener("click", function (event) {
        const match = event.target.closest(".matching-post a");
        if (match) {
          sessionStorage.setItem("fromSearchResult", "true");
        } else {
          sessionStorage.removeItem("fromSearchResult");
        }
      });

      const updateFeedbackButton = () => {
        const markdownSection = document.querySelector(".markdown-section");
        if (!markdownSection) return;

        const h1 = markdownSection.querySelector("h1");
        const currentURL = window.location.href;
        if (h1) {
          const h1Content = encodeURIComponent(h1.textContent.trim());
          const feedbackButton = document.querySelector(".feedback-button");
          if (feedbackButton) {
            feedbackButton.href = `mailto:docsportal-feedback@flexera.com?subject=Documentation topic: ${h1Content}&body=Documentation topic: ${currentURL}`;
          } else {
            feedbackButton.href = `mailto:docsportal-feedback@flexera.com?subject=Documentation topic: General Inquiry&body=Documentation topic: https://docs.spot.io/`;
          }
        }
      };
      updateFeedbackButton();

      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function () {
          const tocElement = document.querySelector(".page_toc");
          function checkScroll() {
            if (window.scrollY > 100) {
              tocElement.classList.add("scrolled");
            } else {
              tocElement.classList.remove("scrolled");
            }
          }

          if (tocElement) {
            window.addEventListener("scroll", checkScroll);
            observer.disconnect();
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  window.$docsify.plugins = [].concat(
    customPlugins,
    window.$docsify.plugins || []
  );
})();
