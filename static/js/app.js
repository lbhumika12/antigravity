// Application State
let state = {
    allReleases: [],
    filteredReleases: [],
    searchText: "",
    activeType: "all",
    selectedRelease: null,
    lastUpdated: ""
};

// DOM Elements
const searchInput = document.getElementById("search-input");
const filterPills = document.getElementById("filter-pills");
const releasesList = document.getElementById("releases-list");
const refreshBtn = document.getElementById("refresh-btn");
const syncTimeSpan = document.getElementById("sync-time");
const statsSummarySpan = document.getElementById("stats-summary-text");

// Sidebar DOM Elements
const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
const tweetBuilder = document.getElementById("tweet-builder");
const selectedRefDate = document.getElementById("ref-date");
const selectedRefType = document.getElementById("ref-type");
const selectedRefSnippet = document.getElementById("ref-snippet");
const tweetTextarea = document.getElementById("tweet-textarea");
const btnTweet = document.getElementById("btn-tweet");
const btnCopy = document.getElementById("btn-copy");
const btnCopyHtml = document.getElementById("btn-copy-html");
const charCountText = document.getElementById("char-count-text");
const charProgressCircle = document.getElementById("char-progress-circle");

// Toast Container
const toastContainer = document.getElementById("toast-container");

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    fetchReleases();
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh button click
    refreshBtn.addEventListener("click", () => {
        fetchReleases(true);
    });

    // Search input typing
    searchInput.addEventListener("input", (e) => {
        state.searchText = e.target.value.trim().toLowerCase();
        applyFilters();
    });

    // Filter pills click
    filterPills.addEventListener("click", (e) => {
        const pill = e.target.closest(".pill");
        if (!pill) return;

        // Toggle active class
        document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");

        state.activeType = pill.dataset.type;
        applyFilters();
    });

    // Tweet text editing
    tweetTextarea.addEventListener("input", () => {
        updateCharCounter();
    });

    // Tweet button click
    btnTweet.addEventListener("click", () => {
        if (!state.selectedRelease) return;
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, "_blank", "width=600,height=400");
        showToast("Twitter Intent opened!", "success");
    });

    // Copy Text button click
    btnCopy.addEventListener("click", () => {
        if (!tweetTextarea.value) return;
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => showToast("Tweet copied to clipboard!", "success"))
            .catch(err => showToast("Failed to copy text", "error"));
    });

    // Copy HTML button click
    btnCopyHtml.addEventListener("click", () => {
        if (!state.selectedRelease) return;
        navigator.clipboard.writeText(state.selectedRelease.html)
            .then(() => showToast("Original HTML content copied!", "success"))
            .catch(err => showToast("Failed to copy HTML", "error"));
    });
}

// Fetch Releases from Backend API
function fetchReleases(forceRefresh = false) {
    // Show spinner and skeleton states
    refreshBtn.classList.add("spinning");
    renderSkeletons();
    
    // Clear selection
    clearSelection();

    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Network response error");
            return response.json();
        })
        .then(res => {
            if (res.success) {
                state.allReleases = res.data;
                state.lastUpdated = res.last_updated;
                
                // Update sync status
                syncTimeSpan.textContent = res.last_updated;
                
                if (forceRefresh) {
                    showToast(res.refetched ? "Feed reloaded fresh from Google Cloud!" : "Using cached feed.", "success");
                }
                
                applyFilters();
            } else {
                throw new Error(res.error || "Unknown server error");
            }
        })
        .catch(err => {
            console.error("Fetch error:", err);
            showToast("Failed to sync release notes. Using offline fallback if available.", "error");
            releasesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Sync Failure</div>
                    <div class="empty-state-text">Could not load releases. Error: ${err.message}. Please retry.</div>
                    <button class="btn btn-primary" onclick="fetchReleases(true)" style="margin-top: 1rem;">Retry Sync</button>
                </div>
            `;
        })
        .finally(() => {
            refreshBtn.classList.remove("spinning");
        });
}

// Render Skeletons during loading
function renderSkeletons() {
    releasesList.innerHTML = Array(4).fill(0).map(() => '<div class="skeleton-card"></div>').join("");
}

// Apply Search and Type Filters
function applyFilters() {
    state.filteredReleases = state.allReleases.filter(release => {
        const matchesType = state.activeType === "all" || release.type === state.activeType;
        const matchesSearch = !state.searchText || 
            release.date.toLowerCase().includes(state.searchText) ||
            release.type.toLowerCase().includes(state.searchText) ||
            release.text.toLowerCase().includes(state.searchText);
        return matchesType && matchesSearch;
    });

    renderReleasesList();
    updateStatsSummary();
}

// Update Stats Counter at toolbar bottom
function updateStatsSummary() {
    const total = state.filteredReleases.length;
    const typeCounts = state.filteredReleases.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
    }, {});

    const breakdown = Object.entries(typeCounts)
        .map(([type, count]) => `<span><strong>${count}</strong> ${type}s</span>`)
        .join(", ");
        
    statsSummarySpan.innerHTML = `Showing <strong>${total}</strong> updates${breakdown ? ' (' + breakdown + ')' : ''}`;
}

// Render the actual Release Cards
function renderReleasesList() {
    if (state.filteredReleases.length === 0) {
        releasesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">No matching releases</div>
                <div class="empty-state-text">Try tweaking your filters or search terms to find what you're looking for.</div>
            </div>
        `;
        return;
    }

    releasesList.innerHTML = "";
    state.filteredReleases.forEach(release => {
        const card = document.createElement("div");
        card.className = "release-card glass-panel";
        card.dataset.id = release.id;
        card.dataset.type = release.type;
        
        if (state.selectedRelease && state.selectedRelease.id === release.id) {
            card.classList.add("selected");
        }

        const badgeClass = `badge-${release.type.toLowerCase()}`;
        const hasSpecificBadge = ['feature', 'issue', 'changed', 'deprecated'].includes(release.type.toLowerCase());
        const displayBadgeClass = hasSpecificBadge ? badgeClass : 'badge-general';

        card.innerHTML = `
            <div class="selection-indicator">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
            </div>
            <div class="card-header">
                <span class="badge ${displayBadgeClass}">${release.type}</span>
                <span class="card-date">${release.date}</span>
            </div>
            <div class="card-body">
                ${release.html}
            </div>
        `;

        card.addEventListener("click", () => {
            selectRelease(release);
        });

        releasesList.appendChild(card);
    });
}

// Handle selection of a release card
function selectRelease(release) {
    state.selectedRelease = release;
    
    // Highlight selected card
    document.querySelectorAll(".release-card").forEach(card => {
        if (card.dataset.id === release.id) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    });

    // Show Tweet builder & Hide placeholder
    sidebarPlaceholder.style.display = "none";
    tweetBuilder.classList.add("active");

    // Populate metadata preview
    selectedRefDate.textContent = release.date;
    selectedRefType.textContent = release.type;
    
    const badgeClass = `badge-${release.type.toLowerCase()}`;
    const hasSpecificBadge = ['feature', 'issue', 'changed', 'deprecated'].includes(release.type.toLowerCase());
    selectedRefType.className = `badge ${hasSpecificBadge ? badgeClass : 'badge-general'}`;
    
    selectedRefSnippet.textContent = release.text;

    // Generate Tweet Draft
    generateTweetDraft(release);
}

// Clear currently selected release
function clearSelection() {
    state.selectedRelease = null;
    document.querySelectorAll(".release-card").forEach(card => card.classList.remove("selected"));
    tweetBuilder.classList.remove("active");
    sidebarPlaceholder.style.display = "flex";
}

// Generate the initial Tweet text dynamically
function generateTweetDraft(release) {
    const titleEmoji = {
        "Feature": "🚀",
        "Issue": "⚠️",
        "Changed": "🔄",
        "Deprecated": "🛑"
    }[release.type] || "📢";

    // Twitter standard limits URLs to 23 characters
    const urlLength = 23;
    const url = release.link || "https://cloud.google.com/bigquery/docs/release-notes";
    
    const prefix = `${titleEmoji} BigQuery ${release.type} [${release.date}]:\n\n`;
    const suffix = `\n\n🔗 ${url}`;
    
    // Calculate space left for the description
    // Total: 280. Description limit: 280 - (prefix length + 23 URL chars + suffix formatting overhead)
    const urlTextOverhead = 4; // space, newline spacer, and link emoji
    const reservedChars = prefix.length + urlLength + urlTextOverhead;
    const availableForDesc = 280 - reservedChars;
    
    let description = release.text;
    if (description.length > availableForDesc) {
        description = description.substring(0, availableForDesc - 4) + "...";
    }

    tweetTextarea.value = `${prefix}${description}${suffix}`;
    updateCharCounter();
}

// Calculate length of tweet considering Twitter URL mapping (URLs count as 23 characters)
function getTwitterTextLength(text) {
    // Regex for matching urls
    const urlRegex = /https?:\/\/[^\s]+/g;
    let length = text.length;
    
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => {
        // Subtract actual length, add 23 characters
        length = length - url.length + 23;
    });
    
    return length;
}

// Update the character counter circle and button state
function updateCharCounter() {
    const text = tweetTextarea.value;
    const length = getTwitterTextLength(text);
    const limit = 280;
    
    charCountText.textContent = `${length} / ${limit}`;
    
    // Circle progress calculation
    const radius = 12.5;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(length / limit, 1);
    const offset = circumference - (percentage * circumference);
    
    charProgressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgressCircle.style.strokeDashoffset = offset;
    
    // Update color styling based on limits
    charCountText.className = "char-count-text";
    if (length > limit) {
        charCountText.classList.add("danger");
        charProgressCircle.style.stroke = "var(--color-issue)";
        btnTweet.disabled = true;
    } else if (length > limit - 20) {
        charCountText.classList.add("warning");
        charProgressCircle.style.stroke = "var(--color-deprecated)";
        btnTweet.disabled = false;
    } else {
        charProgressCircle.style.stroke = "var(--color-feature)";
        btnTweet.disabled = false;
    }

    // Disable tweet button if text is empty
    if (length === 0) {
        btnTweet.disabled = true;
    }
}

// Toast notification runner
function showToast(message, type = "info") {
    // Remove existing toast if it exceeds 3
    if (toastContainer.children.length >= 3) {
        toastContainer.removeChild(toastContainer.firstChild);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    const icon = {
        "success": "✅",
        "error": "❌",
        "info": "ℹ️"
    }[type] || "🔔";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards";
        setTimeout(() => {
            if (toastContainer.contains(toast)) {
                toastContainer.removeChild(toast);
            }
        }, 300);
    }, 4000);
}
