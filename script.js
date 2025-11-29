import Papa from 'papaparse';

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
                    dbData = results.data;
                    console.log('Google Sheet Data loaded:', dbData);
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
    function displayResults(results) {
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
                const aiDescription = person['AI_Description'] || '';

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

                // Helper to linkify text (URLs and Emails)
                const linkify = (text) => {
                    if (!text) return '';

                    // URLs starting with http://, https://, or ftp://
                    const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;

                    // URLs starting with www. (without protocol)
                    const pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

                    // Email addresses
                    const emailPattern = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;

                    return text
                        .replace(urlPattern, '<a href="$1" target="_blank" class="text-link">$1</a>')
                        .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank" class="text-link">$2</a>')
                        .replace(emailPattern, '<a href="mailto:$1" class="text-link">$1</a>');
                };

                // Social
                if (twitterGithub) {
                    const url = ensureProtocol(twitterGithub);
                    const displayLink = `<a href="${url}" target="_blank" class="footer-link">Twitter/Github</a>`;
                    footerHtml += `<div class="footer-row"><span class="footer-label">Social:</span> ${displayLink}</div>`;
                }

                // Website
                if (website) {
                    const url = ensureProtocol(website);
                    const displayLink = `<a href="${url}" target="_blank" class="footer-link">Website</a>`;
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
                        ${aiDescription ? `<div class="ai-description">✨ ${aiDescription}</div>` : ''}
                    </div>

                    <div class="card-footer">
                        ${footerHtml}
                    </div>
                `;
                searchResults.appendChild(item);
            });
        }
    }

    // Handle Search
    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;


        searchResults.innerHTML = '<div class="result-item" style="text-align:center; color: var(--text-secondary);">Searching the archives...</div>';

        // Client-side RAG: Filter data to send relevant context
        let relevantData = dbData.filter(item => {
            const str = JSON.stringify(item).toLowerCase();
            const q = query.toLowerCase();
            return str.includes(q) || q.split(' ').some(word => str.includes(word));
        }).slice(0, 30);

        // Special handling for creator queries
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('who made') || lowerQuery.includes('creator') || lowerQuery.includes('built this')) {
            const creatorEntry = dbData.find(item => item['Name'] && item['Name'].toLowerCase().includes('aryan'));
            if (creatorEntry) {
                // Add creator to the top of the list if not already there
                if (!relevantData.includes(creatorEntry)) {
                    relevantData.unshift(creatorEntry);
                }
            }
        }

        const contextData = relevantData.length > 0 ? relevantData : dbData.slice(0, 20);

        // Call the serverless function
        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    contextData: contextData
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Unknown error from server');
            }

            const content = data.content;
            try {
                // Clean up potential markdown code blocks
                const csvStr = content.replace(/```csv\n?|```/g, '').trim();

                // Parse CSV using PapaParse
                const parsed = Papa.parse(csvStr, {
                    header: true,
                    skipEmptyLines: true
                });

                displayResults(parsed.data);
            } catch (e) {
                console.error("Failed to parse CSV:", content);
                displayResults("Error: Could not parse response from the oracle.");
            }

        } catch (error) {
            console.error('Error:', error);
            displayResults(`Connection error: ${error.message}`);
        }
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
