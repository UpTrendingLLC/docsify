/**
 * Force the logo to always link to the homepage
 */
document.addEventListener("DOMContentLoaded", function () {
  const appNameLink = document.querySelector(".app-name-link");
  if (appNameLink) {
    appNameLink.setAttribute("href", "https://docs.spot.io");
  }
});

(function () {
  /**
   * Stores the search term entered in the search input field into sessionStorage.
   */
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

  /**
   * Highlights the previously stored search term in the main content section
   * only if the user came from a search result.
   */
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


document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.querySelector(".sidebar");
  const mainPanel = document.querySelector(".content article");
  const searchInput = sidebar ? sidebar.querySelector('input[type="search"]') : null;
  const clearButton = sidebar ? sidebar.querySelector(".clear-button") : null;

  let isSearchActive = false;
  const overlay = document.createElement("div");
  overlay.id = "search-overlay";
  document.body.appendChild(overlay);

  if (!sidebar || !mainPanel || !searchInput) {
    console.error("Required elements are missing: sidebar, content, or search input.");
    return;
  }

  function updateSearchResults() {
    const searchResults = sidebar.querySelector(".results-panel.show");
    if (!searchResults) return;

    const resultItems = searchResults.querySelectorAll(".matching-post");
    const resultCount = resultItems.length;

    const searchResultsContent = `
      <div id="search-results">
        <button id="close-search-results" class="spot-btn pink">Close results</button>
        <h1>Search results (${resultCount} ${resultCount === 1 ? "result" : "results"})</h1>
        ${searchResults.innerHTML}
      </div>
    `;

    overlay.innerHTML = searchResultsContent;
    overlay.style.display = "block";
    isSearchActive = true;

    const closeButton = document.getElementById("close-search-results");
    if (closeButton) {
      closeButton.addEventListener("click", function (event) {
        event.stopPropagation();
        closeOverlayAndResetSearch();
      });
    }

    overlay.addEventListener("click", function () {
      closeOverlayAndResetSearch();
    });

    const searchTerm = sessionStorage.getItem("highlightSearchTerm");
    const resultLinks = overlay.querySelectorAll(".matching-post a");
    resultLinks.forEach(function (link) {
      if (searchTerm) {
        const url = new URL(link.href, window.location.origin);
        url.searchParams.set("term", searchTerm);
        url.searchParams.set("fromSearch", "1");
        link.setAttribute("href", url.toString());
      }

      link.addEventListener("click", function (event) {
        sessionStorage.setItem("fromSearchResult", "true");
        event.stopPropagation();
      });
    });
  }

  searchInput.addEventListener("input", function (event) {
    const query = event.target.value.trim();
    if (!query) {
      overlay.style.display = "none";
      isSearchActive = false;
    }
  });

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

  const sidebarObserver = new MutationObserver(function () {
    const searchResults = sidebar.querySelector(".results-panel.show");
    if (searchResults) {
      updateSearchResults();
    }
  });

  sidebarObserver.observe(sidebar, {
    childList: true,
    subtree: true,
  });
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
