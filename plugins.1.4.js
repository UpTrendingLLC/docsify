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
            sessionStorage.removeItem("highlightSearchTerm"); // Clear when search is empty
        }
    }

    searchInput.addEventListener("input", saveSearchTerm);
    searchInput.addEventListener("blur", saveSearchTerm);
}


        /**
         * Highlights the previously stored search term in the main content section.
         */
function highlightStoredSearchTerm() {
    const searchTerm = sessionStorage.getItem("highlightSearchTerm");
    if (!searchTerm) {
        return;
    }

    const content = document.querySelector(".markdown-section");
    if (!content) {
        console.error("Content section not found for highlighting.");
        return;
    }

    const regex = new RegExp(`(${searchTerm})`, "gi");

    function wrapMatches(node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
            if (!node.parentNode || !node.parentNode.classList.contains("highlight")) {
                const fragment = document.createDocumentFragment();
                let lastIndex = 0;

                node.nodeValue.replace(regex, (match, p1, offset) => {
                    fragment.appendChild(
                        document.createTextNode(node.nodeValue.slice(lastIndex, offset))
                    );

                    const span = document.createElement("span");
                    span.className = "highlight";
                    span.textContent = p1;
                    fragment.appendChild(span);

                    lastIndex = offset + p1.length;
                });

                fragment.appendChild(
                    document.createTextNode(node.nodeValue.slice(lastIndex))
                );
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
        let detailsParent = el.closest("details");
        if (detailsParent) {
            detailsParent.setAttribute("open", "");
        }
    });
}


        /**
         * Docsify plugin to trigger highlighting after content loads.
         * @param {Object} hook - Docsify hook object.
         */
        function customHighlightPlugin(hook) {
            hook.doneEach(() => {
                setTimeout(highlightStoredSearchTerm, 500);
            });
        }

        // Register the custom plugin in Docsify
        window.$docsify.plugins = [].concat(
            customHighlightPlugin,
            window.$docsify.plugins || []
        );

        // Initialize search term storage when the page loads
        document.addEventListener("DOMContentLoaded", storeSearchTermOnInput);
    })();

    document.addEventListener("DOMContentLoaded", function () {
        const sidebar = document.querySelector(".sidebar");
        const mainPanel = document.querySelector(".content article");
        const searchInput = sidebar
            ? sidebar.querySelector('input[type="search"]')
            : null;
        const clearButton = sidebar ? sidebar.querySelector(".clear-button") : null; // Target the clear button

        let isSearchActive = false; // Track whether search is active
        const overlay = document.createElement("div"); // Create an overlay element for search results

        // Ensure all necessary elements exist before proceeding
        if (!sidebar || !mainPanel || !searchInput) {
            console.error(
                "Required elements are missing: sidebar, content, or search input."
            );
            return;
        }
        overlay.id = "search-overlay"; // Assign an ID to the overlay
        document.body.appendChild(overlay); // Append overlay to the body

        /**
         * Updates the search results displayed in the overlay
         */
        function updateSearchResults() {
            const searchResults = sidebar.querySelector(".results-panel.show");
            if (!searchResults) return;

            const resultItems = searchResults.querySelectorAll(".matching-post");
            const resultCount = resultItems.length;

            // Create search result content within the overlay
            const searchResultsContent = `
                <div id="search-results">
                    <button id="close-search-results" class="spot-btn pink">close results</button>
                    <h1>search results (${resultCount} ${resultCount === 1 ? "result" : "results"})</h1>
                    ${searchResults.innerHTML}
                </div>
            `;

            overlay.innerHTML = searchResultsContent;
            overlay.style.display = "block"; // Show overlay
            isSearchActive = true;

            // Add event listener to the "Close Results" button
            const closeButton = document.getElementById("close-search-results");
            if (closeButton) {
                closeButton.addEventListener("click", function (event) {
                    event.stopPropagation(); // Prevent click from closing overlay unexpectedly
                    closeOverlayAndResetSearch(); // Close overlay and reset search input
                });
            }

            // Close overlay when clicking anywhere inside it
            overlay.addEventListener("click", function () {
                closeOverlayAndResetSearch();
            });

            // Prevent overlay from closing when clicking on search result links
            const resultLinks = overlay.querySelectorAll(".matching-post");
            resultLinks.forEach(function (link) {
                link.addEventListener("click", function (event) {
                    event.stopPropagation();
                });
            });
        }

        /**
         * Event listener for search input changes to manage overlay visibility
         */
        searchInput.addEventListener("input", function (event) {
            const query = event.target.value.trim();
            if (!query) {
                overlay.style.display = "none"; // Hide overlay if search is cleared
                isSearchActive = false;
            }
        });

        /**
         * Closes the overlay and resets the search input field
         */
        function closeOverlayAndResetSearch() {
            overlay.style.display = "none"; // Hide the overlay
            isSearchActive = false;

            // Clear search input and reset its state
            if (searchInput) {
                searchInput.value = ""; // Clear input
                searchInput.focus(); // Optional: Refocus search input if needed
            }

            // Remove the `.show` class from the clear button if present
            if (clearButton) {
                clearButton.classList.remove("show");
            }
        }

        /**
         * Ensures clicking sidebar links restores the original content and closes the overlay
         */
        sidebar.addEventListener("click", function (event) {
            const target = event.target.closest("a");
            if (target && isSearchActive) {
                overlay.style.display = "none"; // Hide overlay
                isSearchActive = false;

                // Allow sidebar link navigation
                const linkHref = target.getAttribute("href");
                if (linkHref) {
                    window.location.href = linkHref; // Navigate to the link
                }
            }
        });

        // Ensure both the native and custom clear buttons hide the overlay and reset search
        const nativeCloseButton = sidebar.querySelector(".clear-button");
        if (nativeCloseButton) {
            nativeCloseButton.addEventListener("click", function (event) {
                event.stopPropagation();
                closeOverlayAndResetSearch();
            });
        }

        /**
         * Observes sidebar changes to dynamically update search results
         */
        const sidebarObserver = new MutationObserver(function () {
            const searchResults = sidebar.querySelector(".results-panel.show");
            if (searchResults) {
                updateSearchResults();
            }
        });

        // Observe changes in the sidebar's child elements
        sidebarObserver.observe(sidebar, {
            childList: true,
            subtree: true,
        });
    });

    (function () {
        /**
         * Custom plugin to handle search result clicks and additional UI enhancements
         */
        function customPlugins(hook) {
            hook.doneEach(function () {
                // Wait for Docsify to initialize before adding event listeners
                document.addEventListener("click", function (event) {
                    // Check if the clicked element is a search result
                    if (
                        event.target.matches(".matching-post") ||
                        event.target.closest(".matching-post")
                    ) {
                        // Add a class to indicate a search result was clicked
                        document.body.classList.add("search-result-clicked");

                        // Remove the class after a delay if needed
                        setTimeout(() => {
                            document.body.classList.remove("search-result-clicked");
                        }, 2000);
                    }
                });

                /**
                 * Updates the feedback button link dynamically based on the current page
                 */
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

                /**
                 * Adds a "scrolled" class to the Table of Contents (TOC) when the user scrolls past a threshold
                 */
                const observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function () {
                        const tocElement = document.querySelector(".page_toc");

                        // Function to check scroll position and apply class
                        function checkScroll() {
                            if (window.scrollY > 100) {
                                tocElement.classList.add("scrolled");
                            } else {
                                tocElement.classList.remove("scrolled");
                            }
                        }

                        if (tocElement) {
                            window.addEventListener("scroll", checkScroll);
                            observer.disconnect(); // Stop observing once event listener is added
                        }
                    });
                });

                // Observe body changes to detect when TOC is available
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            });
        }

        // Register the custom plugin with Docsify
        window.$docsify.plugins = [].concat(
            customPlugins,
            window.$docsify.plugins || []
        );
    })();
