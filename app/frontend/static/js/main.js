// Create a namespace for the application
window.App = window.App || {};

// Add i18n to the App namespace
App.i18n = {
    init(defaultLang = 'en') {
        this.defaultLang = defaultLang;
        this.currentLang = localStorage.getItem('language') || defaultLang;
        return this.loadTranslations(this.currentLang);
    },

    async loadTranslations(lang) {
        try {
            const response = await fetch(`/translations/${lang}.json`);
            this.translations = await response.json();
            this.updateUI();
            return true;
        } catch (error) {
            console.error('Error loading translations:', error);
            return false;
        }
    },

    t(key) {
        return this.translations[key] || key;
    },

    updateUI() {
        // Update flag and language text
        const currentFlag = document.getElementById('currentFlag');
        const currentLang = document.getElementById('currentLang');
        
        currentFlag.src = this.currentLang === 'pt-br' 
            ? 'img/Flag_of_Brazil.svg' 
            : 'img/uk-flag.jpg';
        currentLang.textContent = this.currentLang === 'pt-br' ? 'PT-BR' : 'ENG';

        // Update all translatable elements
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            element.textContent = this.t(key);
        });
    },

    async changeLanguage(lang) {
        if (lang === this.currentLang) return;
        
        localStorage.setItem('language', lang);
        this.currentLang = lang;
        await this.loadTranslations(lang);
    }
};

// Initialize i18n when the page loads
document.addEventListener('DOMContentLoaded', async function() {
    await App.i18n.init();

    // Update language switcher event listeners
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const lang = item.getAttribute('data-lang');
            await App.i18n.changeLanguage(lang);
        });
    });

    // Panel elements
    const leftPanel = document.getElementById('leftPanel');
    const rightPanel = document.getElementById('rightPanel');
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');

    // Resizing state variables
    let isLeftResizing = false;
    let isRightResizing = false;
    let lastLeftX = 0;
    let lastRightX = 0;

    // Left panel resize handlers
    leftResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isLeftResizing = true;
        lastLeftX = e.clientX;
        document.body.classList.add('no-select');
    });

    // Right panel resize handlers
    rightResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isRightResizing = true;
        lastRightX = e.clientX;
        document.body.classList.add('no-select');
    });

    // Mouse move handler for both panels
    document.addEventListener('mousemove', (e) => {
        // Left panel resizing logic
        if (isLeftResizing) {
            const delta = e.clientX - lastLeftX;
            lastLeftX = e.clientX;
            const newWidth = leftPanel.offsetWidth + delta;
            
            if (newWidth >= 200 && newWidth <= window.innerWidth * 0.5) {
                leftPanel.style.width = `${newWidth}px`;
                leftPanel.style.flexGrow = 0;
                leftPanel.style.flexShrink = 0;
                leftPanel.style.flexBasis = 'auto';
            }
        }
        
        // Right panel resizing logic
        if (isRightResizing) {
            const delta = lastRightX - e.clientX;
            lastRightX = e.clientX;
            const newWidth = rightPanel.offsetWidth + delta;
            
            if (newWidth >= 200 && newWidth <= window.innerWidth * 0.5) {
                rightPanel.style.width = `${newWidth}px`;
                rightPanel.style.flexGrow = 0;
                rightPanel.style.flexShrink = 0;
                rightPanel.style.flexBasis = 'auto';
            }
        }
    });

    // Mouse up handler for both panels
    document.addEventListener('mouseup', () => {
        isLeftResizing = false;
        isRightResizing = false;
        document.body.classList.remove('no-select');
    });

    // Add this to prevent text selection while resizing
    document.addEventListener('selectstart', (e) => {
        if (isLeftResizing || isRightResizing) {
            e.preventDefault();
        }
    });

    // Add cleanup call at the start
    fetch('/cleanup', {
        method: 'POST'
    }).then(response => response.json())
    .catch(error => console.error('Cleanup error:', error));

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    
    if (!dropZone || !fileInput) {
        console.error('Required elements not found:', {
            dropZone: !!dropZone,
            fileInput: !!fileInput
        });
        return;
    }

    // Drag and drop handlers
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });

    // Click to upload functionality
    dropZone.addEventListener('click', () => {
        console.log('Dropzone clicked');
        fileInput.click();
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        console.log('File input changed');
        const files = Array.from(e.target.files);
        
        // Only process if files were actually selected
        if (files && files.length > 0) {
            handleFiles(files);
        }
        
        // Reset the file input value so the same file can be selected again
        fileInput.value = '';
    });

    // Prevent default browser behavior
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
});

// Add these variables at the top with your other global variables
let currentFilePages = [];
let currentPageIndex = 0;
let currentFileName = '';
let uploadedFiles = new Set(); // Track all uploaded files
let savedCorrections = new Set(); // Track files with saved corrections

function showPage(filename, page, pageIndex = null) {
    console.log('Current file pages:', currentFilePages);
    console.log('Current page index:', currentPageIndex);
    
    // Update current filename
    currentFileName = filename;
    
    // Create an overlay canvas for highlighting
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-wrapper';
    imageWrapper.style.position = 'relative';
    
    const img = document.createElement('img');
    // Keep using resources directory for main view to show annotated images
    img.src = `/ressources/${page.preprocessed_path.split('/').pop()}`;
    img.alt = `Page ${page.page} of ${filename}`;
    
    const overlay = document.createElement('canvas');
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.pointerEvents = 'auto';
    
    imageWrapper.appendChild(img);
    imageWrapper.appendChild(overlay);
    
    // Wait for image to load to set canvas dimensions
    img.onload = () => {
        overlay.width = img.width;
        overlay.height = img.height;
        overlay.style.width = `${img.width}px`;
        overlay.style.height = `${img.height}px`;
        
        // Add this to ensure proper initial scaling
        const container = document.getElementById('imageContainer');
        const containerRatio = container.clientWidth / container.clientHeight;
        const imageRatio = img.naturalWidth / img.naturalHeight;
        
        if (imageRatio > containerRatio) {
            // Image is wider than container
            imageWrapper.style.width = '100%';
            imageWrapper.style.height = 'auto';
        } else {
            // Image is taller than container
            imageWrapper.style.width = 'auto';
            imageWrapper.style.height = '100%';
        }
        
        // Add click handler to canvas
        overlay.addEventListener('click', (e) => {
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate scale factors for coordinate conversion
            const scaleX = img.naturalWidth / img.width;
            const scaleY = img.naturalHeight / img.height;
            
            // Convert click coordinates to original image coordinates
            const originalX = x * scaleX;
            const originalY = y * scaleY;
            
            // Find which word box was clicked
            const clickedWord = page.word_objects.find(word => {
                const bbox = word.bbox;
                return (
                    originalX >= bbox.x && 
                    originalX <= bbox.x + bbox.width &&
                    originalY >= bbox.y && 
                    originalY <= bbox.y + bbox.height
                );
            });
            
            if (clickedWord) {
                // Remove highlight from all words
                document.querySelectorAll('.word-item').forEach(el => {
                    el.classList.remove('word-item-active');
                });
                
                // Find and highlight corresponding word in OCR results
                const wordElements = document.querySelectorAll('.word-item');
                const wordIndex = page.word_objects.findIndex(word => 
                    word.bbox.x === clickedWord.bbox.x && 
                    word.bbox.y === clickedWord.bbox.y && 
                    word.text === clickedWord.text
                );
                
                if (wordIndex !== -1) {
                    const wordElement = wordElements[wordIndex];
                    wordElement.classList.add('word-item-active');
                    wordElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                
                // Highlight the box
                highlightBox(clickedWord.bbox, clickedWord.color);
            }
        });
    };
    
    const imageContainer = document.getElementById('imageContainer');
    imageContainer.innerHTML = '';
    imageContainer.appendChild(imageWrapper);
    
    // Update OCR results panel
    const ocrResults = document.getElementById('ocrResults');
    ocrResults.innerHTML = '';
    
    // Add statistics section
    const statsSection = document.createElement('div');
    statsSection.className = 'ocr-stats-section';
    
    // Calculate statistics
    const totalWords = page.word_objects.length;
    const highConfWords = page.word_objects.filter(word => parseFloat(word.confidence) >= 90).length;
    const lowConfWords = totalWords - highConfWords;
    
    statsSection.innerHTML = `
        <div class="stats-header">
            <h5><i class="bi bi-eye"></i> OCR Analysis</h5>
            <div class="confidence-badge">
                <span class="badge bg-primary">
                    <i class="bi bi-graph-up"></i> Mean Confidence: ${page.mean_confidence.toFixed(1)}%
                </span>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-value">${totalWords}</span>
                <span class="stat-label">Total Words</span>
            </div>
            <div class="stat-item">
                <span class="stat-value text-success">${highConfWords}</span>
                <span class="stat-label">High Confidence</span>
            </div>
            <div class="stat-item">
                <span class="stat-value text-danger">${lowConfWords}</span>
                <span class="stat-label">Low Confidence</span>
            </div>
        </div>
    `;
    
    ocrResults.appendChild(statsSection);

    // Add filter controls with radio buttons
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
        <div class="filter-header">
            <i class="bi bi-funnel"></i> Filter Words
        </div>
        <div class="filter-options">
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="confidenceFilter" id="showAll" value="all" checked>
                <label class="form-check-label" for="showAll">All Words</label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="confidenceFilter" id="showHigh" value="high">
                <label class="form-check-label" for="showHigh">
                    <i class="bi bi-check-circle text-success"></i> High Confidence
                </label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="confidenceFilter" id="showLow" value="low">
                <label class="form-check-label" for="showLow">
                    <i class="bi bi-exclamation-circle text-danger"></i> Low Confidence
                </label>
            </div>
        </div>
    `;
    
    ocrResults.appendChild(filterContainer);
    
    const wordContainer = document.createElement('div');
    wordContainer.className = 'word-container';
    
    // Add filter functionality
    const radioButtons = document.querySelectorAll('input[name="confidenceFilter"]');
    
    function updateVisibility() {
        const selectedFilter = document.querySelector('input[name="confidenceFilter"]:checked').value;
        
        document.querySelectorAll('.word-item').forEach(wordItem => {
            switch(selectedFilter) {
                case 'all':
                    wordItem.style.display = 'inline-flex';
                    break;
                case 'high':
                    wordItem.style.display = wordItem.dataset.confidence === 'high' ? 'inline-flex' : 'none';
                    break;
                case 'low':
                    wordItem.style.display = wordItem.dataset.confidence === 'low' ? 'inline-flex' : 'none';
                    break;
            }
        });
    }
    
    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Filter changed to:', radio.value);
            updateVisibility();
        });
    });
    
    // Function to highlight word box on the image
    function highlightBox(bbox, color) {
        const overlay = document.querySelector('#imageContainer canvas');
        const img = document.querySelector('#imageContainer img');
        if (!overlay || !img) return;

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // Berechne das Verhältnis zwischen Original- und angezeigter Bildgröße
        const scaleX = img.width / img.naturalWidth;
        const scaleY = img.height / img.naturalHeight;

        // Berechne die Position des Bildes innerhalb des Containers
        const rect = img.getBoundingClientRect();
        const containerRect = img.parentElement.getBoundingClientRect();
        
        // Setze die Canvas-Größe auf die tatsächliche Bildgröße
        overlay.width = img.width;
        overlay.height = img.height;
        overlay.style.width = `${img.width}px`;
        overlay.style.height = `${img.height}px`;

        // Position des Canvas anpassen
        overlay.style.left = `${rect.left - containerRect.left}px`;
        overlay.style.top = `${rect.top - containerRect.top}px`;

        // Box zeichnen mit korrekter Skalierung
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.rect(
            bbox.x * scaleX,
            bbox.y * scaleY,
            bbox.width * scaleX,
            bbox.height * scaleY
        );
        ctx.stroke();
    }
    
    // Add each word from the word objects
    page.word_objects.forEach(word => {
        const wordElement = document.createElement('div');
        wordElement.className = 'word-item';
        wordElement.dataset.confidence = parseFloat(word.confidence) >= 90 ? 'high' : 'low';
        // Store the original word object for later comparison
        wordElement.dataset.originalWord = JSON.stringify(word);
        
        const wordInput = document.createElement('input');
        wordInput.type = 'text';
        wordInput.className = 'word-input';
        wordInput.value = word.text;
        wordInput.title = `Confidence: ${word.confidence.toFixed(2)}%`;
        
        // Click handler für Box-Binding
        wordElement.addEventListener('click', () => {
            // Remove highlight class from all words
            document.querySelectorAll('.word-item').forEach(el => {
                el.classList.remove('word-item-active');
            });
            
            // Add highlight class to clicked word
            wordElement.classList.add('word-item-active');
            
            // Highlight the corresponding box on the image
            highlightBox(word.bbox, word.color);
        });
        
        wordElement.appendChild(wordInput);
        wordContainer.appendChild(wordElement);
        
        // Breite anpassen
        requestAnimationFrame(() => {
            adjustInputWidth(wordInput);
        });
    });
    
    ocrResults.appendChild(wordContainer);
    
    // Update current page index if provided
    if (pageIndex !== null) {
        currentPageIndex = pageIndex;
    }
    
    // Set up pagination buttons if they exist
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    if (prevButton && nextButton) {
        // Update button states
        prevButton.disabled = currentPageIndex === 0;
        nextButton.disabled = currentPageIndex === currentFilePages.length - 1;
        
        // Add click handlers
        prevButton.onclick = () => {
            if (currentPageIndex > 0) {
                showPage(currentFileName, currentFilePages[currentPageIndex - 1], currentPageIndex - 1);
            }
        };
        
        nextButton.onclick = () => {
            if (currentPageIndex < currentFilePages.length - 1) {
                showPage(currentFileName, currentFilePages[currentPageIndex + 1], currentPageIndex + 1);
            }
        };
    }
    
    // Update file list to show active state
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.classList.remove('active-page');
        
        const itemFileHeader = item.closest('.file-group').querySelector('.file-header .file-name');
        const isCurrentFile = itemFileHeader && itemFileHeader.getAttribute('title') === filename;
        const itemPageNumber = item.querySelector('.page-info span').textContent.replace('Page ', '');
        
        if (isCurrentFile && itemPageNumber === String(page.page)) {
            item.classList.add('active-page');
        }
    });

    // Fügen Sie einen Event-Listener für das Resizing hinzu
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce the resize event
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Finde das aktive Wort und aktualisiere dessen Highlighting
            const activeWord = document.querySelector('.word-item-active');
            if (activeWord) {
                const wordIndex = Array.from(activeWord.parentElement.children).indexOf(activeWord);
                const word = page.word_objects[wordIndex];
                if (word) {
                    highlightBox(word.bbox, word.color);
                }
            }
        }, 100);
    });

    // Add event listener for save button
    document.getElementById('saveCorrections').addEventListener('click', saveCorrections);
}

// Add this new function to reset application state
function resetApplicationState() {
    // Reset global variables
    currentFilePages = [];
    currentPageIndex = 0;
    currentFileName = '';
    uploadedFiles = new Set();
    savedCorrections = new Set();

    // Reset UI elements
    const mainContent = document.getElementById('mainContent');
    const rightPanel = document.getElementById('rightPanel');
    
    // Restore original layout
    mainContent.className = 'col-7 main-content';
    rightPanel.style.display = 'block';
    
    // Reset main content to initial state
    mainContent.innerHTML = `
        <div id="imageContainer" class="h-100 d-flex align-items-center justify-content-center">
            <div id="dropZone" class="text-center p-5">
                <h5>Drop Files Here</h5>
                <p class="text-muted">or use the upload button</p>
            </div>
        </div>
    `;
    
    // Reset right panel
    const ocrResults = document.getElementById('ocrResults');
    if (ocrResults) {
        ocrResults.innerHTML = '';
    }
    
    // Reset file list
    const fileList = document.getElementById('fileList');
    if (fileList) {
        fileList.innerHTML = '';
    }

    // Show LLM processing button container if it was hidden
    const llmContainer = document.querySelector('.llm-processing-container');
    if (llmContainer) {
        llmContainer.style.display = 'block';
    }

    // Reset the LLM button state
    const startLlmButton = document.getElementById('startLlmProcessing');
    if (startLlmButton) {
        startLlmButton.disabled = true;
        startLlmButton.classList.remove('enabled');
        startLlmButton.classList.add('disabled');
    }
}

// Modify the triggerFileInput function
function triggerFileInput() {
    // Just trigger file input click without resetting
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Modify handleFiles function to reset only when actually processing new files
function handleFiles(files) {
    // Only proceed if there are actually files to process
    if (!files || files.length === 0) {
        return;
    }
    
    // Now we can reset since we have files to process
    resetApplicationState();
    
    // Clear previous content
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('ocrResults').innerHTML = '';
    
    // Disable LLM button initially
    const startLlmButton = document.getElementById('startLlmProcessing');
    if (startLlmButton) {
        startLlmButton.disabled = true;
        startLlmButton.classList.remove('enabled');
        startLlmButton.classList.add('disabled');
        startLlmButton.onclick = null; // Remove click handler
    }
    
    const formData = new FormData();
    files.forEach(file => formData.append('file', file));
    
    // Show progress overlay
    const progressOverlay = document.getElementById('progressOverlay');
    const progressBar = document.getElementById('uploadProgress');
    const progressStatus = document.getElementById('progressStatus');
    progressOverlay.style.display = 'flex';
    
    // Calculate total size for progress tracking
    const totalSize = Array.from(files).reduce((acc, file) => acc + file.size, 0);
    let loadedSize = 0;
    
    fetch('/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
            // Update progress during upload
            loadedSize = progressEvent.loaded;
            const progress = (loadedSize / totalSize) * 100;
            progressBar.style.width = `${Math.min(progress, 100)}%`;
            
            if (progress >= 100) {
                progressStatus.textContent = 'Processing files...';
            } else {
                progressStatus.textContent = `Uploading files... ${Math.round(progress)}%`;
            }
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Track uploaded files
        data.results.forEach(result => {
            uploadedFiles.add(result.filename);
        });
        
        updateLlmProcessingButton();
        
        // Update progress for processing phase
        progressStatus.textContent = 'Finalizing...';
        progressBar.style.width = '100%';
        
        // Process results for each file
        data.results.forEach((result, fileIndex) => {
            const fileGroup = createFileGroup(result);
            document.getElementById('fileList').appendChild(fileGroup);
            
            // Show first page by default for the first file
            if (fileIndex === 0) {
                currentFilePages = result.pages;
                currentPageIndex = 0;
                currentFileName = result.filename;
                showPage(result.filename, result.pages[0], 0);
            }
        });
        
        // Hide progress overlay when complete
        setTimeout(() => {
            progressOverlay.style.display = 'none';
            progressBar.style.width = '0%';
        }, 500);
    })
    .catch(error => {
        console.error('Error:', error);
        progressStatus.textContent = 'Error processing files';
        progressBar.classList.add('bg-danger');
        
        // Hide progress overlay after error
        setTimeout(() => {
            progressOverlay.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.classList.remove('bg-danger');
        }, 2000);
        
        alert('Error processing files');
    });
}

// Helper function to shorten filename
function shortenFilename(filename) {
    const maxLength = 20;
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.slice(0, -(extension.length + 1));
    
    if (nameWithoutExt.length <= maxLength - 3) return filename;
    
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${extension}`;
}

function parseOcrData(text) {
    // This is a placeholder - you'll need to implement proper parsing
    // based on your OCR output format
    return text.split(' ').map(word => ({
        text: word,
        confidence: Math.random() * 100 // Replace with actual confidence scores
    }));
}

let currentTimestamp = null;

function saveJson() {
    const data = {
        text: editor.value,
        timestamp: new Date().toISOString()
    };
    
    // Send the data to the backend using the correct endpoint
    fetch('/extraction/', { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            displayStructuredData(result.csv_data);
            currentTimestamp = result.timestamp;
            
            // Show download button and hide process button
            document.getElementById('processButton').style.display = 'none';
            document.getElementById('downloadButton').style.display = 'block';
        } else {
            alert('Error processing text: ' + result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error processing text');
    });
}

function displayStructuredData(csvData) {
    const table = document.getElementById('structuredTable');
    table.innerHTML = '';
    
    // Parse CSV data
    const rows = csvData.split('\n');
    rows.forEach(row => {
        if (row.trim()) {
            const tr = document.createElement('tr');
            row.split(',').forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell.trim();
                tr.appendChild(td);
            });
            table.appendChild(tr);
        }
    });
    
    document.getElementById('editor').style.display = 'none';
    document.getElementById('structuredData').style.display = 'block';
}

function downloadCsv() {
    if (!currentTimestamp) return;
    
    window.location.href = `/extraction/download/${currentTimestamp}`;
}

function adjustInputWidth(input) {
    // Temporäres Element zum Messen der Textbreite
    const tmp = document.createElement('span');
    tmp.style.font = window.getComputedStyle(input).font;
    tmp.style.visibility = 'hidden';
    tmp.style.position = 'absolute';
    tmp.textContent = input.value || 'x'; // Mindestbreite für leere Inputs
    document.body.appendChild(tmp);
    
    // Berechne die benötigte Breite (Text + Padding + Border)
    const padding = 8; // 4px padding auf jeder Seite
    const border = 4; // 2px border auf jeder Seite
    const width = Math.max(30, tmp.offsetWidth + padding + border);
    
    input.style.width = `${width}px`;
    document.body.removeChild(tmp);
}

function getCurrentPageData() {
    const wordItems = document.querySelectorAll('.word-item');
    const updatedWordObjects = Array.from(wordItems).map(wordItem => {
        const wordInput = wordItem.querySelector('.word-input');
        const originalWordObject = JSON.parse(wordItem.dataset.originalWord);
        
        return {
            ...originalWordObject,
            text: wordInput.value // Update the text with the corrected value
        };
    });
    
    return {
        filename: currentFileName,
        page: currentPageIndex + 1,
        word_objects: updatedWordObjects
    };
}

function updateSaveStatus(filename) {
    console.log('Updating save status for:', filename);
    
    const activePage = document.querySelector('.file-item.active-page');
    if (!activePage) {
        console.log('No active page found');
        return;
    }

    // Check if green tick already exists
    let tickCircle = activePage.querySelector('.green-tick-circle');
    if (!tickCircle) {
        tickCircle = document.createElement('div');
        tickCircle.className = 'green-tick-circle';
        tickCircle.innerHTML = '<i class="bi bi-check-lg"></i>';
        activePage.appendChild(tickCircle);
    }

    // Update LLM processing button state
    updateLlmProcessingButton();
}

function saveCorrections() {
    console.log('Save corrections clicked'); // Debug log
    
    const correctedData = getCurrentPageData();
    
    fetch('/ocr/save-corrections', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(correctedData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Save successful, updating status...'); // Debug log
            savedCorrections.add(currentFileName);
            updateLlmProcessingButton();
            showToast('Changes saved successfully!', 'success');
            
            // Update visual indicator in file list
            updateSaveStatus(currentFileName);
        } else {
            throw new Error(data.error || 'Failed to save corrections');
        }
    })
    .catch(error => {
        console.error('Error saving corrections:', error);
        showToast('Error: Failed to save changes', 'error');
    });
}

// Add a toast notification system
function showToast(message, type = 'info') {
    // Remove any existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add appropriate icon based on type
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="bi bi-check-circle-fill"></i>';
            break;
        case 'error':
            icon = '<i class="bi bi-x-circle-fill"></i>';
            break;
        case 'info':
            icon = '<i class="bi bi-info-circle-fill"></i>';
            break;
    }
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Trigger reflow to enable animation
    toast.offsetHeight;
    
    toast.classList.add('show');
    
    // Remove toast after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add this helper function to format file sizes
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add new functions for LLM processing button management
function updateLlmProcessingButton() {
    const startLlmButton = document.getElementById('startLlmProcessing');
    if (!startLlmButton) return;

    // Get all file items (pages) from the file list
    const allPages = document.querySelectorAll('.file-item');
    
    // Check if there are any pages at all
    if (allPages.length === 0) {
        startLlmButton.disabled = true;
        startLlmButton.classList.remove('enabled');
        startLlmButton.classList.add('disabled');
        startLlmButton.onclick = null;
        return;
    }

    // Check if every page has a green tick
    const allPagesSaved = Array.from(allPages).every(page => {
        const hasGreenTick = page.querySelector('.green-tick-circle') !== null;
        return hasGreenTick;
    });

    // Update button state based on whether all pages are saved
    if (allPagesSaved) {
        startLlmButton.disabled = false;
        startLlmButton.classList.remove('disabled');
        startLlmButton.classList.add('enabled');
        startLlmButton.onclick = startLlmProcessing;
    } else {
        startLlmButton.disabled = true;
        startLlmButton.classList.remove('enabled');
        startLlmButton.classList.add('disabled');
        startLlmButton.onclick = null;
    }
}

function startLlmProcessing() {
    // Check if all pages are saved before proceeding
    const allPages = document.querySelectorAll('.file-item');
    const allPagesSaved = Array.from(allPages).every(page => 
        page.querySelector('.green-tick-circle') !== null
    );
    
    if (!allPagesSaved) {
        showToast('Please save all pages before processing', 'error');
        return;
    }

    // Remove existing footer if present
    const existingFooter = document.querySelector('.llm-footer');
    if (existingFooter) {
        existingFooter.remove();
    }

    // Show progress overlay
    const progressOverlay = document.getElementById('progressOverlay');
    const progressBar = document.getElementById('uploadProgress');
    const progressStatus = document.getElementById('progressStatus');
    progressOverlay.style.display = 'flex';
    progressBar.style.width = '0%';
    progressStatus.textContent = 'Processing documents with LLM...';
    
    // Call backend endpoint
    fetch('/extraction/process-all', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayStructuredResults(data.data);
        } else {
            throw new Error(data.error || 'Processing failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Error processing documents', 'error');
    })
    .finally(() => {
        progressOverlay.style.display = 'none';
    });
}

function displayStructuredResults(data) {
    // Hide the LLM processing button container
    const llmContainer = document.querySelector('.llm-processing-container');
    if (llmContainer) {
        llmContainer.style.display = 'none';
    }

    const mainContent = document.getElementById('mainContent');
    const rightPanel = document.getElementById('rightPanel');
    rightPanel.style.display = 'none';
    mainContent.className = 'col-12 main-content';
    mainContent.innerHTML = '';
    
    // Create container
    const container = document.createElement('div');
    container.className = 'llm-analysis-container';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'llm-analysis-header';
    header.innerHTML = `
        <h4>
            <i class="bi bi-cpu-fill"></i>
            LLM Analysis Results
        </h4>
        <p>Medical information extracted from documents</p>
    `;
    container.appendChild(header);
    
    // Create table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    // Create table
    const table = document.createElement('table');
    table.className = 'analysis-table';
    
    // Add table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Variable</th>
            <th>Value</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    // Process documents and fields
    data.documents.forEach(doc => {
        doc.fields.forEach(field => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="field-actions">
                        <span class="editable-field field-name" contenteditable="true" data-original="${field.name}">${field.name}</span>
                        <button type="button" class="btn-delete-row" onclick="deleteRow(this)">
                            <i class="bi bi-dash-circle"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div class="field-actions">
                        <span class="editable-field field-value" contenteditable="true" data-original="${field.value}">${field.value}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
            
            // Add event listeners for editable fields
            const editableFields = row.querySelectorAll('.editable-field');
            editableFields.forEach(field => {
                field.addEventListener('blur', handleFieldEdit);
                field.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        field.blur();
                    }
                });
            });
        });
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
    
    // Create fixed bottom section
    const bottomSection = document.createElement('div');
    bottomSection.className = 'llm-bottom-section';
    bottomSection.innerHTML = `
        <div class="add-field-section">
            <h5>
                <i class="bi bi-plus-circle"></i>
                <span data-translate="addCustomField">Add Custom Field</span>
            </h5>
            <form class="add-field-form" onsubmit="return false;">
                <div class="form-group">
                    <label for="newVariable" data-translate="variable">Variable</label>
                    <input type="text" id="newVariable" required>
                </div>
                <div class="form-group">
                    <label for="newValue" data-translate="value">Value</label>
                    <input type="text" id="newValue">
                </div>
                <button type="button" class="btn-add-field" onclick="addCustomField()">
                    <i class="bi bi-plus-lg"></i>
                </button>
            </form>
        </div>
        <div class="export-section">
            <button class="btn-export" onclick="exportToCSV()">
                <i class="bi bi-download"></i>
                <span data-translate="exportToCsv">Export to CSV</span>
            </button>
        </div>
    `;
    
    container.appendChild(bottomSection);
    mainContent.appendChild(container);

    // Initialize tooltips
    const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltips.map(tooltipTrigger => new bootstrap.Tooltip(tooltipTrigger));
}

// Function to add custom field
function addCustomField() {
    const variable = document.getElementById('newVariable').value.trim();
    const value = document.getElementById('newValue').value.trim();
    const source = document.getElementById('newSource').value.trim();
    
    // Only require variable field
    if (!variable) return;
    
    const tbody = document.querySelector('.analysis-table tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <div class="field-actions">
                <span class="editable-field field-name" contenteditable="true" data-original="${variable}">${variable}</span>
                <button type="button" class="btn-delete-row" onclick="deleteRow(this)">
                    <i class="bi bi-dash-circle"></i>
                </button>
            </div>
        </td>
        <td>
            <div class="field-actions">
                <span class="editable-field field-value" contenteditable="true" data-original="${value || ''}">${value || ''}</span>
            </div>
        </td>
        <td class="text-center">
            <div class="field-actions">
                ${source ? `<button type="button" class="source-info" data-bs-toggle="tooltip" title="${source}">
                    <i class="bi bi-info-circle"></i>
                </button>` : ''}
            </div>
        </td>
    `;
    
    tbody.appendChild(row);
    
    // Add event listeners for editable fields
    const editableFields = row.querySelectorAll('.editable-field');
    editableFields.forEach(field => {
        field.addEventListener('blur', handleFieldEdit);
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                field.blur();
            }
        });
    });
    
    // Initialize tooltip for new row if source exists
    const newTooltip = row.querySelector('[data-bs-toggle="tooltip"]');
    if (newTooltip) {
        new bootstrap.Tooltip(newTooltip);
    }
    
    // Clear form
    document.getElementById('newVariable').value = '';
    document.getElementById('newValue').value = '';
    document.getElementById('newSource').value = '';
}

// Add this new function to handle row deletion
function deleteRow(button) {
    const row = button.closest('tr');
    // Optional: Add fade-out animation
    row.style.transition = 'opacity 0.2s';
    row.style.opacity = '0';
    setTimeout(() => {
        row.remove();
    }, 200);
}

// Function to export to CSV
function exportToCSV() {
    const rows = document.querySelectorAll('.analysis-table tbody tr');
    const csvContent = [];
    
    // Add header with translations
    const translation = translations[currentLanguage];
    csvContent.push([
        translation.variable || 'Variable', 
        translation.value || 'Value'
    ]);
    
    // Create a map to consolidate duplicate variables
    const consolidatedData = new Map();
    
    // Process rows and consolidate values
    rows.forEach(row => {
        const name = row.querySelector('.field-name').textContent.trim();
        const value = row.querySelector('.field-value').textContent.trim();
        
        // If variable already exists, append the value
        if (consolidatedData.has(name)) {
            const existing = consolidatedData.get(name);
            // Only add if it's a different value
            if (!existing.includes(value)) {
                consolidatedData.set(name, `${existing} | ${value}`);
            }
        } else {
            // New variable
            consolidatedData.set(name, value);
        }
    });
    
    // Add consolidated rows to CSV content
    consolidatedData.forEach((value, name) => {
        csvContent.push([name, value]);
    });
    
    // Create CSV content
    const csv = csvContent.map(row => 
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    
    // Update the filename with translation if needed
    const filename = `llm_analysis_results.csv`;
    a.setAttribute('download', filename);
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Add this new function to handle field edits
function handleFieldEdit(event) {
    const field = event.target;
    const originalValue = field.getAttribute('data-original');
    const newValue = field.textContent.trim();
    
    if (originalValue !== newValue) {
        // Show save indicator
        const row = field.closest('tr');
        const saveIndicator = row.querySelector('.save-indicator');
        saveIndicator.classList.add('show');
        
        // Update the original value
        field.setAttribute('data-original', newValue);
        
        // Hide save indicator after 2 seconds
        setTimeout(() => {
            saveIndicator.classList.remove('show');
        }, 2000);
    }
}

// Add this function to create the preview modal
function createPreviewModal() {
    const modal = document.createElement('div');
    modal.className = 'thumbnail-preview-modal';
    modal.innerHTML = `
        <div class="thumbnail-preview-content">
            <button class="thumbnail-preview-close">
                <i class="bi bi-x"></i>
            </button>
            <img class="thumbnail-preview-image" src="" alt="Preview">
        </div>
    `;
    
    // Close on modal background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePreviewModal();
        }
    });
    
    // Close on close button click
    modal.querySelector('.thumbnail-preview-close').addEventListener('click', closePreviewModal);
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closePreviewModal();
        }
    });
    
    document.body.appendChild(modal);
    return modal;
}

// Function to show preview modal
function showPreviewModal(imageSrc) {
    let modal = document.querySelector('.thumbnail-preview-modal');
    if (!modal) {
        modal = createPreviewModal();
    }
    
    const image = modal.querySelector('.thumbnail-preview-image');
    image.src = imageSrc;
    
    // Show modal after image loads
    image.onload = () => {
        modal.classList.add('show');
    };
}

// Function to close preview modal
function closePreviewModal() {
    const modal = document.querySelector('.thumbnail-preview-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Update the createPageElement function (for left panel thumbnails)
function createPageElement(pageNumber, preprocessedPath) {
    const pageItem = document.createElement('div');
    pageItem.className = 'file-item';
    
    // Add thumbnail - use preprocessed directory for thumbnails
    const thumbnail = document.createElement('img');
    thumbnail.className = 'page-thumbnail';
    const filename = preprocessedPath.split('/').pop();
    thumbnail.src = `/preprocessed/${filename}`; // Use preprocessed images for thumbnails
    thumbnail.alt = `Page ${pageNumber} preview`;
    
    // Add click handler for preview - also show preprocessed image in modal
    thumbnail.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the page item click
        showPreviewModal(`/preprocessed/${filename}`); // Show preprocessed image in modal
    });
    
    pageItem.appendChild(thumbnail);
    
    // Rest of the function remains the same...
    const pageInfoContainer = document.createElement('div');
    pageInfoContainer.className = 'page-info';
    
    const pageIcon = document.createElement('i');
    pageIcon.className = 'bi bi-file-text';
    pageInfoContainer.appendChild(pageIcon);
    
    const pageText = document.createElement('span');
    pageText.textContent = `Page ${pageNumber}`;
    pageInfoContainer.appendChild(pageText);
    
    pageItem.appendChild(pageInfoContainer);
    
    return pageItem;
}

function createFileGroup(result) {
    const fileGroup = document.createElement('div');
    fileGroup.className = 'file-group';

    // Create file header
    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header';
    
    const fileIcon = document.createElement('i');
    fileIcon.className = 'bi bi-file-text file-icon';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.title = result.filename;
    fileName.textContent = shortenFilename(result.filename);
    
    fileHeader.appendChild(fileIcon);
    fileHeader.appendChild(fileName);
    fileGroup.appendChild(fileHeader);

    // Create pages container
    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'file-pages';

    // Create page elements with thumbnails
    result.pages.forEach((page, index) => {
        const pageItem = createPageElement(page.page, page.preprocessed_path);
        
        pageItem.onclick = () => {
            currentFilePages = result.pages;
            currentPageIndex = index;
            currentFileName = result.filename;
            showPage(result.filename, page, index);
        };
        
        pagesContainer.appendChild(pageItem);
    });

    fileGroup.appendChild(pagesContainer);
    return fileGroup;
}

// Translation handling
let currentLanguage = 'en';
const translations = {
    'en': null,
    'pt-br': null
};

async function loadTranslations() {
    try {
        translations['en'] = await fetch('/translations/en.json').then(r => r.json());
        translations['pt-br'] = await fetch('/translations/pt-br.json').then(r => r.json());
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

function translateUI(lang) {
    currentLanguage = lang;
    const translation = translations[lang];
    if (!translation) return;

    // Update all elements with data-translate attribute
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translation[key]) {
            // If element is an input value, update the value
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.value = translation[key];
            } else {
                element.textContent = translation[key];
            }
        }
    });

    // Update language display
    document.getElementById('currentLang').textContent = lang.toUpperCase();
    
    // Update flag image
    const flagImg = document.getElementById('currentFlag');
    flagImg.src = lang === 'pt-br' ? 'img/Flag_of_Brazil.svg' : 'img/uk-flag.jpg';
    flagImg.alt = lang === 'pt-br' ? 'Português' : 'English';
}

// Initialize translations
document.addEventListener('DOMContentLoaded', async () => {
    await loadTranslations();
    
    // Set initial language
    translateUI('en');
    
    // Add language switcher event listeners
    document.querySelectorAll('.dropdown-item[data-lang]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = e.currentTarget.getAttribute('data-lang');
            translateUI(lang);
        });
    });
});

// When updating progress status
function updateProgressStatus(status) {
    const progressStatus = document.getElementById('progressStatus');
    if (status === 'finalizing') {
        progressStatus.setAttribute('data-translate', 'finalizing');
        translateUI(currentLanguage); // Retranslate with current language
    } else {
        progressStatus.setAttribute('data-translate', 'uploadingFiles');
        translateUI(currentLanguage);
    }
}