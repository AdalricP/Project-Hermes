import Papa from 'papaparse';
import Fuse from 'fuse.js';

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    // Placeholder for Google Sheet CSV Link - User to provide
    const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1OzR5qE7CyavjVTEdCgflUU2nrE6pwhhxH2eRKimP6ao/export?format=csv";

    let dbData = [];
    // const apiKey = import.meta.env.VITE_GROQ_API_KEY; // Moved to backend

    // Load Data from Google Sheet
    async function loadData() {
        try {
            const response = await fetch(SHEET_CSV_URL);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    // Map raw CSV headers to internal keys
                    dbData = results.data.map(row => ({
                        'Name': row["What's your name?"] || row['Name'],
                        'Title': row["Give us a short title that'd describe your role"] || row['Title'],
                        'Twitter/Github': row['Link to github/twitter?'] || row['Twitter/Github'],
                        'Website': row['Link to website?'] || row['Website'],
                        'Contact (mail)': row['Would you like to let people see your email?'] === 'Yes' ? row['Email Address'] : (row['Contact (mail)'] || ''),
                        'What am I building?': row['What are you working on right now?'] || row['What am I building?'],
                        '/whoami (description)': row['How would you described yourself? (/whoami)'] || row['/whoami (description)']
                    })).filter(item => item.Name); // Filter out empty rows

                    console.log('Google Sheet Data loaded & mapped:', dbData);

                    // Initialize Fuse.js immediately with the mapped data
                    fuse = new Fuse(dbData, fuseOptions);
                },
                error: (err) => {
                    console.error('Error parsing CSV:', err);
                }
            });
        } catch (error) {
            console.error('Error fetching Google Sheet:', error);
        }
    }

    loadData();

    // Display Results
    function displayResults(results, isLoadingAI = false) {
        searchResults.innerHTML = '';

        if (typeof results === 'string') {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'result-item';
            msgDiv.style.color = '#ff6b6b';
            msgDiv.textContent = results;
            searchResults.appendChild(msgDiv);
            return;
        }

        if (Array.isArray(results)) {
            if (results.length === 0) {
                searchResults.innerHTML = '<div class="result-item" style="text-align:center; color: var(--text-secondary);">No results found in the archives.</div>';
                return;
            }

            results.forEach(person => {
                const item = document.createElement('div');
                item.className = 'result-item';

                // Extract fields
                const name = person['Name'] || person['name'] || 'Unknown';
                const title = person['Title'] || person['title'] || 'Builder';
                const twitterGithub = person['Twitter/Github'] || '';
                const website = person['Website'] || '';
                const contact = person['Contact (mail)'] || '';
                const building = person['What am I building?'] || '';
                const whoami = person['/whoami (description)'] || '';
                // const aiDescription = person['AI_Description'] || ''; // We load this dynamically now

                // Avatar Logic
                let avatarUrl = 'assets/default_avatar.png';

                if (twitterGithub) {
                    // GitHub (Reliable)
                    const ghMatch = twitterGithub.match(/github\.com\/([^\/]+)/);
                    if (ghMatch && ghMatch[1]) {
                        avatarUrl = `https://github.com/${ghMatch[1]}.png`;
                    } else {
                        // Twitter/X
                        const twMatch = twitterGithub.match(/(?:twitter\.com|x\.com)\/([^\/]+)/);
                        if (twMatch && twMatch[1]) {
                            // Direct Twitter image links (like x.com/user/photo) are webpages, not images.
                            // They cannot be used in <img src>.
                            // We MUST use a proxy like unavatar.io to get the actual image file.
                            avatarUrl = `https://unavatar.io/twitter/${twMatch[1]}`;
                        }
                    }
                }


                // Build Footer HTML
                let footerHtml = '';

                // Social
                // Helper to ensure URL has protocol
                const ensureProtocol = (url) => {
                    if (!url) return '';
                    if (url.startsWith('http://') || url.startsWith('https://')) return url;
                    return 'https://' + url;
                };

                // Helper to linkify text (URLs only, no emails)
                const linkify = (text) => {
                    if (!text) return '';

                    // URLs starting with http://, https://, or ftp://
                    const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;

                    // URLs starting with www. (without protocol)
                    const pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

                    return text
                        .replace(urlPattern, '<a href="$1" target="_blank" class="text-link">$1</a>')
                        .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank" class="text-link">$2</a>');
                };

                // Social
                if (twitterGithub) {
                    const url = ensureProtocol(twitterGithub);
                    const displayLink = `<a href="${url}" target="_blank" class="footer-link">${url}</a>`;
                    footerHtml += `<div class="footer-row"><span class="footer-label">Social:</span> ${displayLink}</div>`;
                }

                // Website
                if (website) {
                    const url = ensureProtocol(website);
                    const displayLink = `<a href="${url}" target="_blank" class="footer-link">${url}</a>`;
                    footerHtml += `<div class="footer-row"><span class="footer-label">Website:</span> ${displayLink}</div>`;
                }

                // Contact
                if (contact) {
                    footerHtml += `<div class="footer-row"><span class="footer-label">Contact:</span> ${linkify(contact)}</div>`;
                }

                item.innerHTML = `
                    <div class="card-header">
                        <div class="header-left">
                            <h3>${name}</h3>
                            <div class="role-underline">${title}</div>
                        </div>
                        <div class="header-right">
                            <img src="${avatarUrl}" alt="${name}" class="avatar" onerror="this.src='assets/default_avatar.png'">
                        </div>
                    </div>
                    
                    <div class="card-body">
                        ${whoami ? `<div class="whoami">"${linkify(whoami)}"</div>` : ''}
                        ${building ? `<div class="building"><u>Currently building:</u> ${linkify(building)}</div>` : ''}
                        ${isLoadingAI ? `<div class="ai-description loading">✨ Asking the oracle...</div>` : ''}
                    </div>

                    <div class="card-footer">
                        ${footerHtml}
                    </div>
                `;
                searchResults.appendChild(item);
            });
        }
    }

    // Initialize Fuse.js
    let fuse;
    const fuseOptions = {
        keys: [
            { name: 'Name', weight: 0.4 },
            { name: 'Title', weight: 0.2 },
            { name: 'What am I building?', weight: 0.2 },
            { name: '/whoami (description)', weight: 0.2 }
        ],
        threshold: 0.4, // 0.0 is perfect match, 1.0 is match anything
        includeScore: true
    };

    // Handle Search
    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        searchResults.innerHTML = '<div class="result-item" style="text-align:center; color: var(--text-secondary);">Searching the archives...</div>';

        // 1. Local Fuzzy Search with Fuse.js
        if (!fuse) {
            // Fallback if data hasn't loaded yet
            if (dbData.length > 0) {
                fuse = new Fuse(dbData, fuseOptions);
            } else {
                console.warn("Data not loaded yet");
                return;
            }
        }

        let results = fuse.search(query);

        // Special handling for creator queries
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('who made') || lowerQuery.includes('creator') || lowerQuery.includes('built this')) {
            const creatorEntry = dbData.find(item => item['Name'] && item['Name'].toLowerCase().includes('aryan'));
            if (creatorEntry) {
                // Add creator to the top if not already there
                const exists = results.some(r => r.item['Name'] === creatorEntry['Name']);
                if (!exists) {
                    results.unshift({ item: creatorEntry, score: 0 });
                }
            }
        }

        if (results.length === 0) {
            displayResults([]);
            return;
        }

        // Take top 5 results
        const topResults = results.slice(0, 5).map(r => r.item);

        // Display them immediately with loading state for AI description
        displayResults(topResults, true); // true = loading AI descriptions

        // 2. Enrich with AI Descriptions (Parallel)
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    contextData: topResults // Send only the specific people we found
                })
            });

            const data = await response.json();
            if (data.content) {
                // Parse the AI response which should be a map of Name -> Description
                try {
                    const aiDescriptions = JSON.parse(data.content);
                    updateAIDescriptions(aiDescriptions);
                } catch (e) {
                    console.error("Failed to parse AI descriptions:", e);
                }
            }
        } catch (error) {
            console.error('Error fetching AI descriptions:', error);
            // Fail silently, user still sees the search results
        }
    }

    function updateAIDescriptions(descriptions) {
        const items = searchResults.querySelectorAll('.result-item');
        items.forEach(item => {
            const nameEl = item.querySelector('h3');
            if (nameEl) {
                const name = nameEl.textContent;
                if (descriptions[name]) {
                    const body = item.querySelector('.card-body');
                    let aiDiv = body.querySelector('.ai-description');
                    if (!aiDiv) {
                        aiDiv = document.createElement('div');
                        aiDiv.className = 'ai-description';
                        body.appendChild(aiDiv);
                    }
                    aiDiv.innerHTML = `✨ ${descriptions[name]}`;
                    aiDiv.classList.add('fade-in');
                }
            }
        });
    }

    // Event Listeners
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Music Toggle
    const musicToggle = document.getElementById('music-toggle');
    const bgMusic = document.getElementById('bg-music');

    // Set low volume
    bgMusic.volume = 0.02;

    // Try to play by default
    const playMusic = () => {
        bgMusic.play().then(() => {
            musicToggle.classList.add('playing');
        }).catch(e => {
            console.log("Autoplay blocked. Waiting for interaction.");
            // Fallback: Play on first interaction
            const enableAudio = () => {
                bgMusic.play().then(() => {
                    musicToggle.classList.add('playing');
                    document.removeEventListener('click', enableAudio);
                    document.removeEventListener('keydown', enableAudio);
                });
            };
            document.addEventListener('click', enableAudio);
            document.addEventListener('keydown', enableAudio);
        });
    };

    playMusic();

    musicToggle.addEventListener('click', () => {
        if (bgMusic.paused) {
            bgMusic.play().then(() => {
                musicToggle.classList.add('playing');
            });
        } else {
            bgMusic.pause();
            musicToggle.classList.remove('playing');
        }
    });

    // Initial Focus
    searchInput.focus();
});
