// ==UserScript==
// @name         AO3 Journey: Safari Edition
// @namespace    https://archiveofourown.org/
// @version      3.8.1
// @description  Track your complete AO3 journey as both creator and reader (Safari Userscripts compatible). Now with local caching for faster subsequent scans!
// @author       zephyr21
// @match        https://archiveofourown.org/* 
// @match        https://www.archiveofourown.org/*
// @grant        none
// @run-at       document-end
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        REQUEST_DELAY: 1300, // Delay between requests (ms) to respect AO3's servers
        MAX_INBOX_PAGES: 100, // Maximum inbox pages to scan
        DEBUG_MODE: false, // Set to true to see detailed logs in console
        CACHE_KEY: 'ao3_journey_cache', // localStorage key for cached data
        CACHE_VERSION: 4, // Increment this to invalidate old caches (v4: fixed Set serialization bug - works now uses Array)
        PROGRESS_KEY: 'ao3_journey_progress', // localStorage key for scan progress
        SAVE_INTERVAL: 5, // Save progress every N pages
    };
    
    // Export configuration - Fixed dimensions for consistent export
    // Output: 1242px × 1660px fixed size
    const EXPORT_CONFIG = {
        scale: 2,                    // 2x for retina quality
        backgroundColor: '#ffffff',
        imageType: 'image/png',
        
        // Annual Report fixed dimensions - 1242px × 1660px output
        annualReport: {
            width: 621,              // 621px × 2 scale = 1242px output
            height: 830,             // 830px × 2 scale = 1660px output (fixed)
            padding: {
                container: '30px 12px 20px 12px', // Top/sides/bottom
                section: '14px 12px',   // Card internal padding (enlarged)
                page: '0 10px',         // Page padding
            },
            margin: {
                section: '10px',     // Margin between sections (enlarged)
                header: '15px',      // Header margin bottom (more space before page label)
            },
            font: {
                year: '62px',        // 2025 - enlarged 120%
                subtitle: '26px',    // 年度报告 - enlarged 120%
                userInfo: '20px',    // Username, 这是你在AO3的第X年 - enlarged 120%
                pageLabel: '22px',   // 阅读者报告 / 创作者报告
                text: '19px',        // Body text font size - enlarged 120%
                lineHeight: '1.5',   // Line height (tighter)
                highlight: '1.15em', // Highlight text relative size
                number: '1.2em',     // Number relative size
                quote: '20px',       // Footer quote font size - enlarged
                blessing: '22px',    // Footer blessing font size
            },
            colors: {
                background: '#fff5f5',   // Light pink background
                text: '#111',            // Main text color
                accent: '#990000',       // Dark red accent
                divider: 'rgba(153,0,0,0.35)', // Divider color
            },
            borderRadius: '12px',    // Section border radius
            dividerHeight: '2px',    // Divider line height
        },
        
        // Year View - dynamic height based on content
        yearView: {
            width: 540,              // 540px × 2 scale = 1080px output
            padding: '15px',
            backgroundColor: '#ffffff',
            scale: 3,                // Higher scale for sharper export
            // Height is dynamic - calculated from content
        },
    };
    
    // Debug logging helper
    function debugLog(...args) {
        if (CONFIG.DEBUG_MODE) {
            console.log('[AO3 Journey]', ...args);
        }
    }
    
    // Apply fixed export styles for annual report - uses EXPORT_CONFIG dimensions
    function applyAnnualReportExportStyles(clonedDoc, currentPageNum) {
        const cfg = EXPORT_CONFIG.annualReport;
        
        // Fix container - fixed size 1242px × 1660px (at 2x scale), flex-start layout with auto-margin footer
        const container = clonedDoc.querySelector('.annual-report-container');
        if (container) {
            container.style.cssText = `
                width: ${cfg.width}px !important;
                max-width: ${cfg.width}px !important;
                height: ${cfg.height}px !important;
                min-height: ${cfg.height}px !important;
                background: ${cfg.colors.background} !important;
                background-image: none !important;
                padding: ${cfg.padding.container} !important;
                border-radius: 0 !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: flex-start !important;
                box-sizing: border-box !important;
                position: relative !important;
            `;
            
            // FIRST: Mark the correct page as export-active BEFORE cloning footer
            clonedDoc.querySelectorAll('.report-page').forEach(page => {
                if (page.dataset.page === currentPageNum) {
                    page.classList.add('export-active');
                } else {
                    page.classList.remove('export-active');
                }
            });
            
            // Hide all footers inside report-pages
            clonedDoc.querySelectorAll('.report-page .report-footer').forEach(f => {
                f.style.cssText = 'display: none !important;';
            });
            
            // NOW clone footer from the correctly marked active page
            const activePage = clonedDoc.querySelector('.report-page.export-active');
            const footer = activePage ? activePage.querySelector('.report-footer') : 
                          clonedDoc.querySelector('.report-footer');
            
            if (footer) {
                const footerClone = footer.cloneNode(true);
                container.appendChild(footerClone);
                footerClone.style.cssText = `
                    display: block !important;
                    flex-shrink: 0 !important;
                    width: 100% !important;
                    text-align: center !important;
                    padding: 0 !important;
                    margin-top: auto !important;
                    margin-bottom: 0 !important;
                    margin-left: 0 !important;
                    margin-right: 0 !important;
                `;
            }
        }
        
        // Fix wrapper
        const wrapper = clonedDoc.querySelector('.annual-report-wrapper');
        if (wrapper) {
            wrapper.style.cssText = `
                background: ${cfg.colors.background} !important;
                background-image: none !important;
                padding: 0 !important;
                width: 100% !important;
            `;
        }
        
        // Fix header - no extra padding, content starts at container padding
        const header = clonedDoc.querySelector('.report-header');
        if (header) {
            header.style.cssText = `
                margin-bottom: ${cfg.margin.header} !important;
                text-align: center !important;
                padding-top: 0 !important;
            `;
        }
        
        // Fix year title (2025) - slightly smaller
        clonedDoc.querySelectorAll('.report-year').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.year} !important;
                color: ${cfg.colors.accent} !important;
                background: none !important;
                -webkit-text-fill-color: ${cfg.colors.accent} !important;
                margin-bottom: 5px !important;
                line-height: 1 !important;
            `;
        });
        
        // Fix subtitle (年度报告) - larger with more space below
        clonedDoc.querySelectorAll('.report-subtitle').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.subtitle} !important;
                color: #666 !important;
                letter-spacing: 6px !important;
                margin-bottom: 15px !important;
            `;
        });
        
        // Fix years-badge (Username, 这是你在AO3的第X年) - centered with more space below
        clonedDoc.querySelectorAll('.years-badge').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.userInfo} !important;
                padding: 10px 20px !important;
                background: ${cfg.colors.accent} !important;
                color: #fff !important;
                border-radius: 25px !important;
                margin-bottom: 15px !important;
                text-align: center !important;
            `;
        });
        
        // Fix years-badge number to be WHITE (not red)
        clonedDoc.querySelectorAll('.years-badge .report-number').forEach(el => {
            el.style.cssText = `
                color: #fff !important;
                -webkit-text-fill-color: #fff !important;
                font-weight: 700 !important;
                font-size: 1.3em !important;
            `;
        });
        
        // Fix page-label (阅读者报告 / 创作者报告) - larger
        clonedDoc.querySelectorAll('.page-label').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.pageLabel} !important;
                font-weight: 700 !important;
                color: ${cfg.colors.accent} !important;
                margin-bottom: 10px !important;
            `;
        });
        
        // Fix carousel - natural height, content flows naturally
        const carousel = clonedDoc.querySelector('.report-carousel');
        if (carousel) {
            carousel.style.cssText = `
                overflow: visible !important;
                width: 100% !important;
                flex: none !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-start !important;
                position: static !important;
            `;
        }
        
        const carouselTrack = clonedDoc.querySelector('.report-carousel-track');
        if (carouselTrack) {
            carouselTrack.style.cssText = 'transform: none !important; display: block !important; width: 100% !important;';
        }
        
        // Show only active page - natural height (no flex grow for consistent spacing)
        clonedDoc.querySelectorAll('.report-page').forEach(page => {
            if (page.dataset.page === currentPageNum) {
                page.classList.add('export-active');
                page.style.cssText = `
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    width: 100% !important;
                    padding: ${cfg.padding.page} !important;
                    overflow: visible !important;
                    flex: none !important;
                `;
            } else {
                page.style.cssText = 'display: none !important;';
            }
        });
        
        // Fix sections - internal cards with natural height, compact spacing
        clonedDoc.querySelectorAll('.report-section').forEach(el => {
            el.style.cssText = `
                background: #ffffff !important;
                background-image: none !important;
                padding: 10px 10px !important;
                border-radius: ${cfg.borderRadius} !important;
                margin-bottom: 8px !important;
                box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.12) !important;
                overflow: hidden !important;
                flex: none !important;
            `;
        });
        
        // Fix text elements - reduced line height + hanging indent for emoji + smaller paragraph gap
        clonedDoc.querySelectorAll('.report-text').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.text} !important;
                line-height: ${cfg.font.lineHeight} !important;
                color: ${cfg.colors.text} !important;
                text-align: left !important;
                margin-bottom: 4px !important;
                word-break: break-word !important;
                padding-left: 1.5em !important;
                text-indent: -1.5em !important;
            `;
        });
        
        // Fix closing text - centered
        clonedDoc.querySelectorAll('.report-closing').forEach(el => {
            el.style.textAlign = 'center';
            el.style.marginBottom = '5px';
        });
        
        // Fix dividers - gradient like web page, reduced margin
        clonedDoc.querySelectorAll('.report-divider').forEach(el => {
            el.style.cssText = `
                height: 1px !important;
                background: linear-gradient(90deg, transparent, rgba(153,0,0,0.25), transparent) !important;
                margin: 6px 0 !important;
                display: block !important;
                border: none !important;
            `;
        });
        
        // Fix highlights and numbers
        clonedDoc.querySelectorAll('.report-highlight').forEach(el => {
            el.style.cssText = `font-size: ${cfg.font.highlight} !important; font-weight: 700 !important;`;
        });
        
        // Fix report-number but EXCLUDE the one inside years-badge (should stay white)
        clonedDoc.querySelectorAll('.report-number').forEach(el => {
            // Skip if inside years-badge - should remain WHITE
            if (el.closest('.years-badge')) {
                return;
            }
            el.style.cssText = `
                font-size: ${cfg.font.number} !important;
                font-weight: 700 !important;
                color: ${cfg.colors.accent} !important;
            `;
        });
        
        // Fix footer (the cloned one at container level) - margin-top: auto pushes to bottom
        clonedDoc.querySelectorAll('.annual-report-container > .report-footer').forEach(el => {
            el.style.cssText = `
                display: block !important;
                flex-shrink: 0 !important;
                width: 100% !important;
                text-align: center !important;
                padding: 0 !important;
                margin-top: auto !important;
                margin-bottom: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            `;
        });
        
        // Fix decoration (stars)
        clonedDoc.querySelectorAll('.report-decoration').forEach(el => {
            el.style.cssText = `
                font-size: 16px !important;
                color: rgba(153, 0, 0, 0.4) !important;
                margin-bottom: 6px !important;
                letter-spacing: 8px !important;
                display: block !important;
            `;
        });
        
        // Fix decoration end (flower)
        clonedDoc.querySelectorAll('.report-decoration-end').forEach(el => {
            el.style.cssText = `
                font-size: 20px !important;
                margin-top: 8px !important;
                opacity: 0.8 !important;
                display: block !important;
            `;
        });
        
        clonedDoc.querySelectorAll('.report-quote').forEach(el => {
            el.style.cssText = `font-size: ${cfg.font.quote} !important; color: #444 !important; font-style: italic !important; margin-bottom: 10px !important;`;
        });
        
        clonedDoc.querySelectorAll('.report-blessing').forEach(el => {
            el.style.cssText = `
                font-size: ${cfg.font.blessing} !important;
                font-weight: 700 !important;
                color: ${cfg.colors.accent} !important;
                background: none !important;
                -webkit-text-fill-color: ${cfg.colors.accent} !important;
            `;
        });
        
        // Fix nowrap
        clonedDoc.querySelectorAll('.nowrap').forEach(el => {
            el.style.whiteSpace = 'nowrap';
        });
        
        // Hide indicators and hints
        const indicators = clonedDoc.querySelector('.page-indicators');
        if (indicators) indicators.style.display = 'none';
        
        const swipeHint = clonedDoc.querySelector('.swipe-hint');
        if (swipeHint) swipeHint.style.display = 'none';
        
        // Check if content overflows and shrink text if needed
        shrinkTextIfOverflow(clonedDoc, cfg);
    }
    
    /**
     * Shrink text if content overflows the container
     * @param {Document} clonedDoc - The cloned document
     * @param {Object} cfg - EXPORT_CONFIG.annualReport
     */
    function shrinkTextIfOverflow(clonedDoc, cfg) {
        const container = clonedDoc.querySelector('.annual-report-container');
        if (!container) return;
        
        // Available height = container height - top padding - bottom padding
        // Padding is '30px 12px 20px 12px' (top right bottom left)
        const availableHeight = cfg.height - 30 - 20; // 830 - 30 - 20 = 780px
        
        // Get content height (header + carousel + footer)
        const header = container.querySelector('.report-header');
        const carousel = container.querySelector('.report-carousel');
        const footer = container.querySelector('.annual-report-container > .report-footer') || 
                       container.querySelector('.report-footer');
        
        const headerHeight = header ? header.offsetHeight : 0;
        const carouselHeight = carousel ? carousel.scrollHeight : 0;
        const footerHeight = footer ? footer.offsetHeight : 0;
        
        const totalContentHeight = headerHeight + carouselHeight + footerHeight;
        
        debugLog(`Export content check: available=${availableHeight}px, content=${totalContentHeight}px`);
        
        // If content fits, no need to shrink
        if (totalContentHeight <= availableHeight) {
            debugLog('Content fits, no shrinking needed');
            return;
        }
        
        // Calculate shrink ratio (minimum 0.75 to maintain readability)
        const overflowRatio = availableHeight / totalContentHeight;
        const shrinkRatio = Math.max(0.75, overflowRatio);
        
        debugLog(`Content overflow! Shrinking by ratio: ${shrinkRatio.toFixed(2)}`);
        
        // Shrink text elements
        const originalTextSize = parseFloat(cfg.font.text) || 19;
        const originalLineHeight = parseFloat(cfg.font.lineHeight) || 1.5;
        const newTextSize = Math.floor(originalTextSize * shrinkRatio);
        const newLineHeight = Math.max(1.3, originalLineHeight * shrinkRatio);
        
        clonedDoc.querySelectorAll('.report-text').forEach(el => {
            el.style.fontSize = `${newTextSize}px`;
            el.style.lineHeight = `${newLineHeight}`;
            el.style.marginBottom = `${Math.floor(4 * shrinkRatio)}px`;
        });
        
        // Shrink section padding
        clonedDoc.querySelectorAll('.report-section').forEach(el => {
            el.style.padding = `${Math.floor(10 * shrinkRatio)}px ${Math.floor(10 * shrinkRatio)}px`;
            el.style.marginBottom = `${Math.floor(8 * shrinkRatio)}px`;
        });
        
        // Shrink dividers
        clonedDoc.querySelectorAll('.report-divider').forEach(el => {
            el.style.margin = `${Math.floor(6 * shrinkRatio)}px 0`;
        });
        
        // Shrink page label
        const originalPageLabel = parseFloat(cfg.font.pageLabel) || 22;
        clonedDoc.querySelectorAll('.page-label').forEach(el => {
            el.style.fontSize = `${Math.floor(originalPageLabel * shrinkRatio)}px`;
            el.style.marginBottom = `${Math.floor(8 * shrinkRatio)}px`;
        });
        
        debugLog(`Text shrunk: ${originalTextSize}px → ${newTextSize}px`);
    }
    
    // Apply fixed export styles for year view - 1080px width, dynamic height
    function applyYearViewExportStyles(clonedDoc, width, height) {
        const cfg = EXPORT_CONFIG.yearView;
        
        // Since we're capturing .year-view.active directly, we need to style it as the root
        const activeYearView = clonedDoc.querySelector('.year-view.active');
        if (activeYearView) {
            activeYearView.style.cssText = `
                display: block !important;
                visibility: visible !important;
                background: #ffffff !important;
                background-image: none !important;
                background-color: #ffffff !important;
                padding: 15px !important;
                opacity: 1 !important;
                width: ${width}px !important;
                max-width: ${width}px !important;
                min-height: ${height}px !important;
                box-sizing: border-box !important;
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
            `;
        }
        
        // Fix section cards - solid backgrounds, no gradients
        clonedDoc.querySelectorAll('.section-card').forEach(el => {
            let bgColor = '#ffffff';
            let borderColor = '#e0e0e0';
            if (el.classList.contains('creator')) {
                bgColor = '#fffafa';
                borderColor = '#990000';
            } else if (el.classList.contains('reader')) {
                bgColor = '#f8fffd';
                borderColor = '#2a9d8f';
            }
            
            el.style.cssText = `
                background: ${bgColor} !important;
                background-image: none !important;
                opacity: 1 !important;
                box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.08) !important;
                width: 100% !important;
                box-sizing: border-box !important;
                margin-bottom: 15px !important;
                border-radius: 12px !important;
                padding: 15px !important;
                overflow: visible !important;
                border-left: 4px solid ${borderColor} !important;
            `;
        });
        
        // Fix section titles - color based on parent card type
        clonedDoc.querySelectorAll('.section-title').forEach(el => {
            let titleColor = '#333';
            const parentCard = el.closest('.section-card');
            if (parentCard) {
                if (parentCard.classList.contains('creator')) {
                    titleColor = '#990000';
                } else if (parentCard.classList.contains('reader')) {
                    titleColor = '#2a9d8f';
                }
            }
            el.style.cssText = `
                font-size: 16px !important;
                font-weight: 700 !important;
                color: ${titleColor} !important;
                margin-bottom: 12px !important;
            `;
        });
        
        // Fix stats grid
        clonedDoc.querySelectorAll('.stats-grid').forEach(el => {
            el.style.cssText = `
                display: grid !important;
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
                margin-bottom: 15px !important;
            `;
        });
        
        // Fix stat boxes - solid equivalent of rgba(0,0,0,0.04)
        clonedDoc.querySelectorAll('.stat-box').forEach(el => {
            el.style.cssText = `
                background: #f5f5f5 !important;
                background-image: none !important;
                opacity: 1 !important;
                border-radius: 12px !important;
                padding: 15px !important;
                text-align: center !important;
            `;
        });
        
        // Fix stat labels - match original #555
        clonedDoc.querySelectorAll('.stat-label').forEach(el => {
            el.style.cssText = `
                font-size: 12px !important;
                color: #555 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                margin-bottom: 6px !important;
                font-weight: 600 !important;
            `;
        });
        
        // Fix stat values - match original #111
        clonedDoc.querySelectorAll('.stat-value').forEach(el => {
            el.style.cssText = `
                font-size: 28px !important;
                font-weight: 700 !important;
                color: #111 !important;
                line-height: 1 !important;
            `;
        });
        
        // Fix subsection labels
        clonedDoc.querySelectorAll('.subsection-label').forEach(el => {
            el.style.cssText = `
                font-size: 13px !important;
                font-weight: 600 !important;
                color: #555 !important;
                margin: 15px 0 8px 0 !important;
            `;
        });
        
        // Fix list items - no card, just border-bottom
        clonedDoc.querySelectorAll('.list-item').forEach(el => {
            el.style.cssText = `
                background: transparent !important;
                background-image: none !important;
                opacity: 1 !important;
                padding: 8px 0 !important;
                border-radius: 0 !important;
                margin-bottom: 0 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                border: none !important;
                border-bottom: 1px solid #eee !important;
            `;
        });
        
        // Fix list item titles - match original #111
        clonedDoc.querySelectorAll('.list-item-title, .work-link').forEach(el => {
            el.style.cssText = `
                font-size: 13px !important;
                color: #111 !important;
                font-weight: 600 !important;
                text-decoration: none !important;
                flex: 1 !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            `;
        });
        
        // Fix list item values - color based on parent card type
        clonedDoc.querySelectorAll('.list-item-value').forEach(el => {
            let valueColor = '#990000'; // default
            const parentCard = el.closest('.section-card');
            if (parentCard && parentCard.classList.contains('reader')) {
                valueColor = '#2a9d8f';
            }
            el.style.cssText = `
                font-size: 12px !important;
                color: ${valueColor} !important;
                font-weight: 600 !important;
                margin-left: 10px !important;
                white-space: nowrap !important;
            `;
        });
        
        // Hide elements that shouldn't be in export
        clonedDoc.querySelectorAll('.year-view:not(.active), .annual-report-view, .report-confirm-view').forEach(el => {
            el.style.cssText = 'display: none !important; height: 0 !important; overflow: hidden !important;';
        });
        
        // Hide header, tabs, buttons
        ['journey-header', 'year-tabs', 'journey-header-buttons', 'annual-report-banner'].forEach(id => {
            const el = clonedDoc.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    // ==================== STATE ====================
    let isScanning = false; 
    let yearlyStats = {};
    let allWorksDebug = []; // Store all works with their parsed dates for debugging
    let hasConfirmedAnnualReport = false; // Track if user has already seen confirmation
    let isIncrementalScan = false; // Track if this is a partial scan (using cache)
    let cachedYears = []; // Years loaded from cache
    let processedWorkUrls = new Set(); // Track processed work URLs to prevent duplication
    
    // Tags to exclude from "other tags" (these are archive warnings, not tropes)
    const ARCHIVE_WARNINGS = [
        "Creator Chose Not To Use Archive Warnings",
        "Graphic Depictions Of Violence", 
        "Major Character Death",
        "No Archive Warnings Apply",
        "Rape/Non-Con",
        "Underage"
    ];

    // ==================== STYLES ====================
    const styles = `
        #floating-journey-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #990000 0%, #660000 100%);
            color: white;
            border: 2px solid rgba(255,255,255,0.3);
            padding: 14px 24px;
            border-radius: 50px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            z-index: 999999;
            cursor: pointer;
            font-size: 15px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            transition: all 0.2s ease;
            -webkit-tap-highlight-color: transparent;
        }
        #floating-journey-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(0,0,0,0.6);
        }
        
        /* Mobile: Slightly smaller button, keep bottom-right position */
        @media (max-width: 600px) {
            #floating-journey-btn {
                bottom: 15px;
                right: 15px;
                padding: 12px 18px;
                font-size: 14px;
            }
        }
        
        #journey-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            height: -webkit-fill-available; /* iOS Safari fix */
            background: radial-gradient(ellipse at center, 
                rgba(249, 249, 249, 1) 0%,
                rgba(249, 249, 249, 1) 50%,
                rgba(249, 249, 249, 0.97) 60%,
                rgba(249, 249, 249, 0.9) 70%,
                rgba(249, 249, 249, 0.75) 80%,
                rgba(249, 249, 249, 0.5) 90%,
                rgba(249, 249, 249, 0.2) 100%
            );
            z-index: 1000000;
            display: none;
            flex-direction: column;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            color: #111;
            overflow-y: scroll; /* Changed from auto to scroll */
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            box-sizing: border-box;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom, 20px); /* Safe area for notch devices */
            touch-action: pan-y; /* Allow vertical scrolling */
        }
        
        #journey-wrapper {
            width: 100%;
            max-width: 650px;
            margin: 80px auto 20px auto;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            min-height: min-content;
        }
        
        /* Mobile: Adjust wrapper for better scrolling */
        @media (max-width: 600px) {
            #journey-wrapper {
                margin: 10px auto 20px auto;
                border-radius: 12px;
                width: calc(100% - 16px);
                max-width: none;
            }
        }
        
        #journey-header {
            position: relative;
            top: 0;
            background: transparent !important;
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
            padding: 15px 15px 15px 15px;
            z-index: 100;
            border-bottom: none;
            border-radius: 20px 20px 0 0;
        }
        
        /* Mobile: smaller header */
        @media (max-width: 480px) {
            #journey-header {
                padding: 10px 10px 10px 10px;
            }
        }
        
        #journey-header.hidden {
            display: none;
        }
        
        #journey-header-buttons {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
        }
        
        #journey-title {
            color: #990000;
            margin: 0;
            font-family: 'Times New Roman', Times, serif;
            font-size: 1.4em;
            font-weight: normal;
            letter-spacing: -0.5px;
            text-align: left;
        }
        
        #journey-title-container {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 12px;
            margin-bottom: 18px;
            padding-left: 10px;
        }
        
        #ao3-header-logo {
            height: 36px;
            width: auto;
        }
        
        @media (max-width: 480px) {
            #journey-header-buttons {
                margin-bottom: 12px;
            }
            #journey-title {
                font-size: 1.1em;
            }
            #journey-title-container {
                gap: 8px;
                margin-bottom: 20px;
                padding-left: 5px;
            }
            #ao3-header-logo {
                height: 28px;
            }
        }
        
        #close-journey,
        #export-journey,
        #refresh-journey {
            background: #990000 !important;
            background-color: #990000 !important;
            background-image: none !important;
            color: #ffffff !important;
            border: none !important;
            border-color: transparent !important;
            padding: 10px 20px !important;
            border-radius: 50px !important;
            font-weight: bold !important;
            font-size: 13px !important;
            cursor: pointer !important;
            transition: all 0.2s ease;
            -webkit-tap-highlight-color: transparent;
            -webkit-appearance: none !important;
            appearance: none !important;
            touch-action: manipulation;
            box-shadow: none !important;
            text-shadow: none !important;
        }
        #close-journey:hover,
        #close-journey:active,
        #close-journey:focus,
        #export-journey:hover,
        #export-journey:active,
        #export-journey:focus,
        #refresh-journey:hover,
        #refresh-journey:active,
        #refresh-journey:focus {
            background: #bb0000 !important;
            background-color: #bb0000 !important;
            color: #ffffff !important;
        }
        #export-journey,
        #refresh-journey {
            display: none;
            margin-right: 8px !important;
        }
        #export-journey.visible,
        #refresh-journey.visible {
            display: inline-block;
        }
        #export-journey:disabled,
        #refresh-journey:disabled {
            opacity: 0.6 !important;
            cursor: wait !important;
        }
        
        @media (max-width: 480px) {
            #close-journey,
            #export-journey,
            #refresh-journey {
                padding: 8px 12px !important;
                font-size: 11px !important;
            }
        }
        
        #annual-report-banner {
            margin: 15px 0;
            padding: 0 20px;
            text-align: center;
        }
        
        .annual-report-tab {
            display: inline-block;
            padding: 12px 28px !important;
            background: linear-gradient(135deg, #990000 0%, #cc3333 50%, #990000 100%) !important;
            color: white !important;
            border: none !important;
            border-radius: 25px !important;
            font-weight: 700 !important;
            font-size: 15px !important;
            cursor: pointer;
            -webkit-animation: tabGlow 2s ease-in-out infinite;
            animation: tabGlow 2s ease-in-out infinite;
            box-shadow: 0 4px 15px rgba(153, 0, 0, 0.3);
            transition: all 0.2s ease;
            -webkit-tap-highlight-color: transparent;
        }
        
        .annual-report-tab:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(153, 0, 0, 0.4);
        }
        
        /* Mobile: smaller annual tab */
        @media (max-width: 480px) {
            .annual-report-tab {
                padding: 6px 12px !important;
                font-size: 11px !important;
                border-radius: 15px !important;
            }
            #annual-report-banner {
                margin: 12px 0 8px 0;
                padding: 0 10px !important;
            }
        }
        
        #year-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            padding: 0 20px 10px 20px;
        }
        
        @media (max-width: 480px) {
            #year-tabs {
                padding-top: 5px !important;
            }
        }
        
        /* Keep year tabs visible for navigation - no longer hiding them */
        
        .year-tab {
            padding: 10px 18px;
            background: #fff;
            color: #666;
            border: 1px solid #ddd;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
            -webkit-tap-highlight-color: transparent;
        }
        .year-tab:hover {
            background: #f5f5f5;
            color: #333;
        }
        .year-tab.active {
            background: linear-gradient(135deg, #990000 0%, #cc0000 100%);
            color: white;
            border-color: #990000;
        }
        
        #journey-content {
            padding: 20px;
            padding-bottom: 30px;
            width: 100%;
            box-sizing: border-box;
            touch-action: pan-y; /* Allow vertical scrolling */
        }
        
        @media (max-width: 600px) {
            #journey-content {
                padding: 12px;
                padding-bottom: 20px;
            }
        }
        
        .year-view {
            display: none;
            -webkit-animation: fadeIn 0.3s ease;
            animation: fadeIn 0.3s ease;
            padding-bottom: 20px;
            touch-action: pan-y; /* Allow vertical scrolling */
        }
        .year-view.active {
            display: block;
        }
        
        @media (max-width: 600px) {
            .year-view {
                padding-bottom: 10px;
            }
        }
        
        @-webkit-keyframes fadeIn {
            from { opacity: 0; -webkit-transform: translateY(10px); transform: translateY(10px); }
            to { opacity: 1; -webkit-transform: translateY(0); transform: translateY(0); }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .section-card {
            background: #fff;
            padding: 20px;
            border-radius: 16px;
            border: 1px solid #e0e0e0;
            margin-bottom: 15px;
            box-sizing: border-box;
            box-shadow: 4px 4px 12px rgba(0, 0, 0, 0.1);
        }
        .section-card:last-child {
            margin-bottom: 0;
        }
        .section-card.creator {
            border-left: 4px solid #990000;
            background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
        }
        .section-card.reader {
            border-left: 4px solid #2a9d8f;
            background: linear-gradient(135deg, #fff 0%, #f5fffd 100%);
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 700;
            text-transform: none;
            letter-spacing: 0.5px;
            margin: 0 0 20px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .section-card.creator .section-title { color: #990000; }
        .section-card.reader .section-title { color: #2a9d8f; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .stat-box {
            background: rgba(0,0,0,0.04);
            padding: 15px;
            border-radius: 12px;
        }
        .stat-label {
            font-size: 12px;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
            font-weight: 600;
        }
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #111;
            line-height: 1;
        }
        
        .subsection-label {
            font-size: 14px;
            font-weight: 600;
            color: #444;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 20px 0 10px 0;
            padding-top: 15px;
            border-top: 1px solid #eee;
        }
        .subsection-label:first-of-type {
            margin-top: 0;
            padding-top: 0;
            border-top: none;
        }
        
        .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
        }
        .list-item:last-child {
            border-bottom: none;
        }
        
        .list-item-title {
            color: #111;
            font-weight: 600;
            flex: 1;
            margin-right: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .list-item-value {
            color: #990000;
            font-weight: 700;
            white-space: nowrap;
        }
        .section-card.reader .list-item-value {
            color: #2a9d8f;
        }
        
        .work-link {
            color: #111 !important;
            font-weight: 600;
            text-decoration: none;
            transition: color 0.2s;
        }
        .work-link:hover {
            color: #990000 !important;
        }
        
        .empty-state {
            color: #888;
            font-size: 12px;
            font-style: italic;
            padding: 10px 0;
        }
        
        #progress-view {
            text-align: center;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 50vh;
        }
        #progress-title {
            font-size: 1.3em;
            font-weight: 700;
            margin-bottom: 20px;
            color: #990000;
        }
        #progress-title .dots {
            display: inline-block;
        }
        #progress-title .dots::after {
            content: '';
            -webkit-animation: dots 1.5s steps(4, end) infinite;
            animation: dots 1.5s steps(4, end) infinite;
        }
        @-webkit-keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
            100% { content: ''; }
        }
        @keyframes dots {
            0% { content: ''; }
            25% { content: '.'; }
            50% { content: '..'; }
            75% { content: '...'; }
            100% { content: ''; }
        }
        #progress-status {
            color: #666;
            font-size: 14px;
            margin-bottom: 15px;
        }
        #progress-bar-container {
            background: #ddd;
            border-radius: 10px;
            height: 8px;
            overflow: hidden;
            margin: 0 auto 10px auto;
            width: 80%;
            max-width: 300px;
        }
        #progress-bar {
            background: linear-gradient(90deg, #990000 0%, #cc3333 100%);
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
            border-radius: 10px;
        }
        #progress-detail {
            color: #888;
            font-size: 12px;
        }
        
        #results-view {
            display: none;
        }
        
        /* ==================== 年度报告 ANNUAL REPORT STYLES ==================== */
        
        @-webkit-keyframes tabGlow {
            0%, 100% { box-shadow: 0 4px 15px rgba(153, 0, 0, 0.3); }
            50% { box-shadow: 0 4px 25px rgba(204, 51, 51, 0.5); }
        }
        @keyframes tabGlow {
            0%, 100% { box-shadow: 0 4px 15px rgba(153, 0, 0, 0.3); }
            50% { box-shadow: 0 4px 25px rgba(204, 51, 51, 0.5); }
        }
        
        .annual-report-view {
            display: none;
            font-family: 'Noto Serif SC', 'PingFang SC', 'Hiragino Sans GB', 'KaiTi', 'STKaiti', serif !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            touch-action: pan-y;
        }
        .annual-report-view.active {
            display: block;
            -webkit-animation: fadeIn 0.5s ease;
            animation: fadeIn 0.5s ease;
        }
        
        /* Desktop wrapper - clean white background */
        .annual-report-wrapper {
            width: 100%;
            min-height: 100%;
            display: -webkit-box;
            display: flex;
            -webkit-box-pack: center;
            justify-content: center;
            -webkit-box-align: start;
            align-items: flex-start;
            padding: 0;
            box-sizing: border-box;
            background: #fff;
            touch-action: pan-y;
        }
        
        /* Light red container - full width to match white background */
        .annual-report-container {
            background: linear-gradient(180deg, 
                #ffffff 0%, 
                #fff8f8 10%, 
                #fff5f5 25%, 
                #fff0f0 50%, 
                #fff5f5 75%, 
                #fff8f8 90%, 
                #ffffff 100%);
            padding: 8px 0 10px 0;
            position: relative;
            overflow: visible;
            width: 100%;
            min-height: auto;
            display: block;
            box-sizing: border-box;
            touch-action: pan-y;
        }
        
        /* AO3 Branding in annual report */
        .report-branding {
            position: absolute;
            top: 3px;
            left: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 10;
        }
        
        .report-branding-logo {
            height: 14px;
            width: auto;
        }
        
        .report-branding-text {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11px;
            font-weight: normal;
            color: #990000;
            line-height: 14px;
        }
        
        /* Carousel wrapper */
        .report-carousel {
            position: relative;
            overflow: hidden;
            touch-action: pan-x pan-y;
            -webkit-overflow-scrolling: touch;
        }
        
        .report-carousel-track {
            display: -webkit-box;
            display: flex;
            -webkit-transition: -webkit-transform 0.3s ease-in-out;
            transition: transform 0.3s ease-in-out;
            will-change: transform;
        }
        
        .report-page {
            width: 100%;
            min-width: 100%;
            -webkit-box-flex: 0;
            flex-shrink: 0;
            padding: 0 10px;
            box-sizing: border-box;
        }
        
        .report-page .report-section {
            -webkit-box-flex: 0;
            flex: none;
            display: block;
            height: auto;
        }
        
        /* Page indicators */
        .page-indicators {
            display: -webkit-box;
            display: flex;
            -webkit-box-pack: center;
            justify-content: center;
            gap: 12px;
            padding: 12px 0 8px 0;
            -webkit-box-flex: 0;
            flex-shrink: 0;
        }
        
        .page-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #ddd;
            cursor: pointer;
            -webkit-transition: all 0.3s ease;
            transition: all 0.3s ease;
            -webkit-tap-highlight-color: transparent;
            border: none;
            padding: 0;
        }
        
        .page-dot.active {
            background: #8B0000;
            -webkit-transform: scale(1.2);
            transform: scale(1.2);
        }
        
        .page-dot:hover {
            background: #cc6666;
        }
        
        /* Swipe hint */
        .swipe-hint {
            text-align: center;
            color: #999;
            font-size: 12px;
            padding: 5px 0;
            opacity: 1;
            -webkit-transition: opacity 0.5s ease;
            transition: opacity 0.5s ease;
            -webkit-box-flex: 0;
            flex-shrink: 0;
        }
        
        .swipe-hint.hidden {
            opacity: 0;
            height: 0;
            padding: 0;
        }
        
        /* Page title label */
        .page-label {
            text-align: center;
            font-size: 16px;
            color: #990000;
            font-weight: 700;
            margin-top: 5px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 3px;
            -webkit-box-flex: 0;
            flex-shrink: 0;
        }
        
        @media (max-width: 480px) {
            .page-label {
                margin-top: 0;
                margin-bottom: 8px;
            }
        }
        
        @media (min-width: 768px) {
            .page-label {
                font-size: 18px;
                margin-top: 8px;
                margin-bottom: 15px;
            }
        }
        
        /* Subtle floating particles - light theme */
        .annual-report-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                radial-gradient(2px 2px at 20px 30px, rgba(153,0,0,0.08), transparent),
                radial-gradient(2px 2px at 40px 70px, rgba(204,51,51,0.06), transparent),
                radial-gradient(2px 2px at 50px 160px, rgba(153,0,0,0.06), transparent),
                radial-gradient(2px 2px at 90px 40px, rgba(153,0,0,0.08), transparent),
                radial-gradient(2px 2px at 130px 80px, rgba(204,51,51,0.06), transparent),
                radial-gradient(2px 2px at 160px 120px, rgba(153,0,0,0.06), transparent);
            background-size: 200px 200px;
            pointer-events: none;
        }
        
        .report-header {
            text-align: center;
            margin-bottom: 15px;
            padding-top: 5px;
            position: relative;
            z-index: 1;
        }
        
        .report-year {
            font-size: 60px;
            font-weight: 700;
            background: linear-gradient(135deg, #990000 0%, #cc3333 50%, #990000 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1;
            margin-bottom: 8px;
        }
        
        .report-subtitle {
            font-size: 16px;
            color: #666;
            letter-spacing: 4px;
            margin-bottom: 25px;
        }
        
        .report-section {
            background: rgba(255, 255, 255, 0.95);
            -webkit-backdrop-filter: blur(10px);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 16px 14px;
            margin-bottom: 12px;
            border: 1px solid rgba(153, 0, 0, 0.1);
            box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.12);
            position: relative;
            z-index: 1;
            overflow: hidden;
            box-sizing: border-box;
            width: 100%;
        }
        
        .report-section.creator {
            border-left: 4px solid #990000;
        }
        
        .report-section.reader {
            border-left: 4px solid #cc3333;
        }
        
        .report-text {
            font-size: 17px;
            line-height: 1.8;
            color: #111;
            text-align: left;
            margin-bottom: 12px;
            word-break: break-word;
            overflow-wrap: break-word;
            -webkit-hyphens: auto;
            hyphens: auto;
        }
        
        .nowrap {
            white-space: nowrap;
            display: inline;
        }
        
        .report-text:last-child {
            margin-bottom: 0;
        }
        
        .report-highlight {
            color: #b8860b;
            font-weight: 700;
            font-size: 1.35em;
        }
        
        .report-highlight.pink {
            color: #990000;
        }
        
        .report-highlight.blue {
            color: #cc3333;
        }
        
        .report-highlight.green {
            color: #228b22;
        }
        
        .report-number {
            font-size: 1.5em;
            font-weight: 700;
            color: #990000;
        }
        
        .report-emoji {
            font-size: 1.1em;
            margin: 0 2px;
        }
        
        .report-divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(153,0,0,0.2), transparent);
            margin: 14px 0;
        }
        
        .report-footer {
            text-align: center;
            margin-top: 20px;
            padding: 15px 20px 20px 20px;
            position: relative;
            z-index: 1;
        }
        
        .report-decoration {
            font-size: 16px;
            color: rgba(153, 0, 0, 0.4);
            margin-bottom: 6px;
            letter-spacing: 8px;
            margin-bottom: 15px;
        }
        
        .report-quote {
            font-size: 17px;
            color: #444;
            font-style: italic;
            margin-bottom: 12px;
            padding: 0 10px;
        }
        
        .report-blessing {
            font-size: 22px;
            font-weight: 700;
            background: linear-gradient(135deg, #990000 0%, #cc3333 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .report-decoration-end {
            font-size: 20px;
            margin-top: 8px;
            opacity: 0.8;
        }
        
        .years-badge {
            display: inline-block;
            background: linear-gradient(135deg, #990000 0%, #cc3333 100%);
            color: white;
            padding: 10px 22px;
            border-radius: 50px;
            font-size: 17px;
            margin-bottom: 20px;
            box-shadow: 0 4px 15px rgba(153, 0, 0, 0.4);
            text-align: center;
        }
        
        .years-badge .report-number {
            color: #fff;
            font-weight: 700;
            font-size: 1.3em;
        }
        
        /* ==================== CONFIRMATION UI (AO3 Exact Style) ==================== */
        
        .report-confirm-view {
            display: none;
            background: transparent;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
        }
        .report-confirm-view.active {
            display: block;
        }
        
        .confirm-container {
            padding: 20px 5px;
            max-width: 95%;
            width: 100%;
            margin: 0 auto;
            font-family: Georgia, serif;
            font-size: 14px;
            color: #333;
            background: #fff;
            border-radius: 12px;
            box-sizing: border-box;
        }
        
        .confirm-branding {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            margin-bottom: 15px;
            padding-left: 5px;
        }
        
        .confirm-branding-logo {
            height: 30px;
            width: auto;
        }
        
        .confirm-branding-text {
            font-family: 'Times New Roman', Times, serif;
            font-size: 20px;
            font-weight: normal;
            color: #990000;
            line-height: 30px;
        }
        
        @media (max-width: 480px) {
            .confirm-container {
                padding: 15px 3px;
            }
            .confirm-branding {
                margin-bottom: 10px;
            }
            .confirm-branding-logo {
                height: 24px;
            }
            .confirm-branding-text {
                font-size: 16px;
                line-height: 24px;
            }
        }
        
        .confirm-warning-box {
            background: #ffe34e;
            border: 1px solid #d89e36;
            border-radius: 8px;
            padding: 5px;
            margin-bottom: 15px;
            box-shadow: inset 1px 1px 0 #4e4518, inset 2px 2px 0 #b39f37;
        }
        
        @media (max-width: 480px) {
            .confirm-warning-box {
                padding: 3px;
            }
        }
        
        .confirm-warning-text {
            color: #333;
            font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif;
            font-size: 0.875em;
            line-height: 1.5;
            font-weight: normal;
        }
        
        .confirm-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 15px;
        }
        
        .confirm-btn {
            padding: 5px 15px !important;
            font-family: 'Lucida Sans Unicode', 'Lucida Grande', sans-serif !important;
            font-size: 0.875em !important;
            font-weight: normal !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            text-decoration: none !important;
            color: #333 !important;
            -webkit-tap-highlight-color: transparent;
            -webkit-appearance: none !important;
            appearance: none !important;
        }
        
        .confirm-btn.yes {
            background: #eee !important;
            background-color: #eee !important;
            background-image: linear-gradient(to bottom, #fff 0%, #ddd 100%) !important;
            border: 1px solid #bbb !important;
            box-shadow: inset 0 -2px 3px #aaaaaa !important;
        }
        .confirm-btn.yes:hover {
            background: #ddd !important;
            background-image: linear-gradient(to bottom, #eee 0%, #ccc 100%) !important;
        }
        
        .confirm-btn.no {
            background: #ddd !important;
            background-color: #ddd !important;
            background-image: linear-gradient(to bottom, #ddd 0%, #ccc 100%) !important;
            border: 1px solid #bbb !important;
            box-shadow: inset 0 -2px 3px #aaaaaa !important;
            -webkit-tap-highlight-color: transparent;
        }
        .confirm-btn.no:hover {
            background: #ccc !important;
            background-image: linear-gradient(to bottom, #ccc 0%, #bbb 100%) !important;
        }
        
        /* Mobile: ensure warning text is not bold */
        @media (max-width: 480px) {
            .confirm-warning-text {
                font-weight: normal !important;
            }
        }
        
        .confirm-subtitle {
            color: #666;
            font-size: 11px;
            line-height: 1.5;
        }
        
        /* Mobile: smaller text for annual report */
        @media (max-width: 480px) {
            .report-header {
                padding-top: 15px !important;
            }
            .report-year {
                font-size: 42px !important;
            }
            .report-subtitle {
                font-size: 13px !important;
                letter-spacing: 2px !important;
                margin-bottom: 15px !important;
            }
            .years-badge {
                font-size: 13px !important;
                padding: 8px 16px !important;
                margin-bottom: 12px !important;
                text-align: center !important;
            }
            .years-badge .report-number {
                font-size: 1.2em !important;
            }
            .report-section {
                padding: 14px 12px !important;
                margin-bottom: 10px !important;
                border-radius: 10px !important;
            }
            .report-text {
                font-size: 14px !important;
                line-height: 1.7 !important;
                margin-bottom: 8px !important;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
            }
            .report-highlight {
                font-size: 1.1em !important;
            }
            .report-number {
                font-size: 1.2em !important;
            }
            .report-emoji {
                font-size: 1em !important;
            }
            .report-divider {
                margin: 10px 0 !important;
            }
            .arm-emoji {
                display: none !important;
            }
            .report-footer {
                margin-top: 12px !important;
                padding: 10px 15px 15px 15px !important;
            }
            .report-quote {
                font-size: 14px !important;
            }
            .report-blessing {
                font-size: 18px !important;
            }
            .annual-report-wrapper {
                padding: 0 !important;
                background: #fff !important;
            }
            .annual-report-container {
                padding: 5px 0 8px 0 !important;
                min-height: auto !important;
            }
            .report-carousel {
                margin: 0;
            }
            .report-page {
                padding: 0 3px;
            }
            .page-label {
                font-size: 14px !important;
                margin-top: 0 !important;
                margin-bottom: 6px !important;
            }
            .page-indicators {
                padding: 8px 0 5px 0 !important;
            }
            .page-dot {
                width: 8px !important;
                height: 8px !important;
            }
            .swipe-hint {
                font-size: 10px !important;
                padding: 3px 0 !important;
            }
            .report-text {
                font-size: 15px !important;
                line-height: 1.7 !important;
                margin-bottom: 10px !important;
                word-break: break-word !important;
                overflow-wrap: break-word !important;
            }
            .report-divider {
                margin: 12px 0 !important;
            }
            
            /* Year tabs smaller */
            .year-tab {
                padding: 6px 12px !important;
                font-size: 12px !important;
            }
            #year-tabs {
                gap: 5px !important;
                padding: 0 10px 8px 10px !important;
            }
            
            /* Section cards smaller */
            .section-card {
                padding: 12px !important;
                margin-bottom: 10px !important;
            }
            .section-title {
                font-size: 14px !important;
                margin-bottom: 12px !important;
            }
            .stats-grid {
                gap: 8px !important;
                margin-bottom: 15px !important;
            }
            .stat-box {
                padding: 10px !important;
            }
            .stat-label {
                font-size: 10px !important;
            }
            .stat-value {
                font-size: 22px !important;
            }
            .list-item {
                font-size: 12px !important;
                padding: 8px 0 !important;
            }
            .subsection-label {
                font-size: 12px !important;
                font-weight: 600 !important;
                color: #444 !important;
                margin: 12px 0 8px 0 !important;
            }
        }
        
        /* iOS/Safari specific adjustments */
        @supports (-webkit-touch-callout: none) {
            #floating-journey-btn {
                padding: 16px 26px;
            }
            .year-tab, .annual-report-tab {
                padding: 12px 20px;
            }
        }
        
        /* ==================== EXPORT MODE STYLES ==================== */
        /* These styles are applied during PNG export to fix html2canvas issues */
        
        .export-mode .annual-report-container::before {
            content: none !important;
            display: none !important;
            background: none !important;
        }
        
        .export-mode .annual-report-container {
            background: #fff5f5 !important;
            background-image: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
        }
        
        .export-mode .report-branding {
            position: absolute !important;
            top: 8px !important;
            left: 8px !important;
            display: flex !important;
            gap: 8px !important;
            z-index: 10 !important;
        }
        
        .export-mode .report-branding-logo {
            height: 22px !important;  /* increased by 2px */
            width: auto !important;
        }
        
        .export-mode .report-branding-text {
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 18px !important;  /* increased by 2px */
            font-weight: normal !important;
            color: #990000 !important;
            line-height: 22px !important;  /* Match logo height */
        }
        
        .export-mode .annual-report-wrapper,
        .export-mode .annual-report-view {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff5f5 !important;
        }
        
        /* Fix text layout consistency for export - 1242px × 1660px output */
        .export-mode .report-text {
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            font-size: 18px !important;
            line-height: 1.6 !important;
            margin-bottom: 8px !important;
            font-family: 'Noto Serif SC', 'PingFang SC', 'Hiragino Sans GB', serif !important;
            text-align: left !important;
        }
        
        .export-mode .report-year {
            font-size: 56px !important;
            margin-bottom: 5px !important;
        }
        
        .export-mode .report-subtitle {
            font-size: 26px !important;
            letter-spacing: 6px !important;
            margin-bottom: 8px !important;
        }
        
        .export-mode .years-badge {
            font-size: 20px !important;
            padding: 10px 20px !important;
            color: #fff !important;
            text-align: center !important;
        }
        
        .export-mode .years-badge .report-number {
            color: #fff !important;
            -webkit-text-fill-color: #fff !important;
        }
        
        .export-mode .page-label {
            font-size: 22px !important;
            margin-bottom: 10px !important;
        }
        
        .export-mode .report-section {
            padding: 14px 12px !important;
            margin-bottom: 10px !important;
        }
        
        .export-mode .report-divider {
            margin: 8px 0 !important;
        }
        
        .export-mode .report-footer {
            padding: 10px 15px !important;
            margin-top: auto !important;
        }
        
        .export-mode .report-highlight {
            font-size: 1.25em !important;
            font-weight: 700 !important;
        }
        
        .export-mode .report-footer {
            display: block !important;
            visibility: visible !important;
            margin-top: 20px !important;
            padding: 15px 20px 20px 20px !important;
        }
        
        .export-mode .report-quote {
            font-size: 17px !important;
            color: #444 !important;
            font-style: italic !important;
            display: block !important;
        }
        
        .export-mode .report-blessing {
            font-size: 22px !important;
            font-weight: 700 !important;
            color: #990000 !important;
            display: block !important;
        }
        
        .export-mode .nowrap {
            white-space: nowrap !important;
        }
        
        .export-mode .report-number {
            font-size: 1.4em !important;
            color: #990000 !important;
            font-weight: 700 !important;
        }
        
        /* Override: years-badge number must be WHITE */
        .export-mode .years-badge .report-number {
            color: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
        }
        
        .export-mode .report-divider {
            height: 1px !important;
            background: linear-gradient(90deg, transparent, rgba(153,0,0,0.25), transparent) !important;
            margin: 6px 0 !important;
            display: block !important;
            width: 100% !important;
            border: none !important;
        }
        
        .export-mode .report-closing {
            text-align: center !important;
            display: block !important;
            width: 100% !important;
        }
        
        .export-mode .report-carousel-track {
            display: block !important;
            -webkit-transform: none !important;
            transform: none !important;
        }
        
        .export-mode .report-carousel {
            overflow: visible !important;
        }
        
        /* Only show the active/current page during export */
        .export-mode .report-page {
            display: none !important;
        }
        
        .export-mode .report-page.export-active {
            display: block !important;
            width: 100% !important;
            min-width: auto !important;
            flex: none !important;
        }
        
        /* Hide navigation elements during export */
        .export-mode .page-indicators,
        .export-mode .swipe-hint {
            display: none !important;
        }
        
        .export-mode body {
            overflow: hidden !important;
        }
        
        .export-mode #journey-wrapper {
            margin: 0 !important;
            padding: 0 !important;
        }
    `;

    // ==================== UTILITIES ====================

    /**
     * Get the current logged-in username from the page
     */
    function getLoggedInUsername() {
        // Method 1: Look for "Hi, username!" text - most reliable
        const greeting = document.getElementById('greeting');
        if (greeting) {
            const greetingText = greeting.textContent || '';
            const hiMatch = greetingText.match(/Hi,\s*([^!]+)!/i);
            if (hiMatch) {
                const username = hiMatch[1].trim();
                debugLog('Found username via "Hi, username!" text:', username);
                return username;
            }
        }
        
        // Method 2: Search header area only for "Hi, username" pattern (optimized)
        const headerArea = document.querySelector('header, #header, .header, nav, .navigation, #greeting');
        if (headerArea) {
            const text = headerArea.textContent || '';
            const match = text.match(/Hi,\s*([A-Za-z0-9_-]+)/i);
            if (match && match[1].length > 1 && match[1].length < 50) {
                debugLog('Found username via header search:', match[1]);
                return match[1];
            }
        }
        
        // Method 3: Fall back to link selectors
        const selectors = [
            '#greeting .user a[href^="/users/"]',
            '#greeting a[href^="/users/"]',
            'a.user[href^="/users/"]',
            '.navigation a[href^="/users/"]',
            'a[href*="/users/"][href*="/pseuds/"]'
        ];
        
        for (const selector of selectors) {
            const userMenu = document.querySelector(selector);
            if (userMenu) {
                const href = userMenu.getAttribute('href');
                const match = href.match(/\/users\/([^/]+)/);
                if (match) {
                    debugLog('Found username via selector:', selector, '→', match[1]);
                    return decodeURIComponent(match[1]);
                }
            }
        }
        
        debugLog('⚠️ Could not find username');
        debugLog('Greeting element:', greeting ? greeting.textContent : 'not found');
        return null;
    }

    /**
     * Sleep for a specified duration
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch a page and parse it as HTML
     */
    async function fetchPage(url) {
        debugLog('Fetching:', url);
        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: { 'Accept': 'text/html' },
                mode: 'same-origin'
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.status}`);
            }
            const text = await response.text();
            const parser = new DOMParser();
            return parser.parseFromString(text, 'text/html');
        } catch (error) {
            debugLog('❌ Fetch error:', error.message);
            throw error;
        }
    }

    /**
     * Get total pages from pagination element
     */
    function getTotalPages(doc) {
        const pagination = doc.querySelector('ol.pagination');
        if (!pagination) return 1;

        const pageLinks = pagination.querySelectorAll('li a');
        let maxPage = 1;
        
        pageLinks.forEach(link => {
            const num = parseInt(link.textContent, 10);
            if (!isNaN(num) && num > maxPage) {
                maxPage = num;
            }
        });
        
        return maxPage;
    }

    /**
     * Parse a date string and extract the year reliably
     */
    function extractYear(dateStr) {
        if (!dateStr) return null;
        const yearMatch = dateStr.match(/\b(20\d{2}|19\d{2})\b/);
        if (yearMatch) {
            return parseInt(yearMatch[1], 10);
        }
        return null;
    }

    /**
     * Convert relative time string to year
     */
    function parseRelativeTime(relativeStr) {
        if (!relativeStr) return null;
        
        const now = new Date();
        const str = relativeStr.toLowerCase().trim();
        
        let match = str.match(/(\d+)\s*days?\s*ago/);
        if (match) {
            const days = parseInt(match[1], 10);
            const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            return date.getFullYear();
        }
        
        match = str.match(/(\d+)\s*weeks?\s*ago/);
        if (match) {
            const weeks = parseInt(match[1], 10);
            const date = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
            return date.getFullYear();
        }
        
        match = str.match(/(\d+)\s*months?\s*ago/);
        if (match) {
            const months = parseInt(match[1], 10);
            const date = new Date(now);
            date.setMonth(date.getMonth() - months);
            return date.getFullYear();
        }
        
        match = str.match(/(\d+)\s*years?\s*ago/);
        if (match) {
            const years = parseInt(match[1], 10);
            return now.getFullYear() - years;
        }
        
        if (str.includes('a day ago') || str.includes('1 day ago') || str.includes('yesterday')) {
            const date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return date.getFullYear();
        }
        if (str.includes('a week ago')) {
            const date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date.getFullYear();
        }
        if (str.includes('a month ago')) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - 1);
            return date.getFullYear();
        }
        if (str.includes('a year ago')) {
            return now.getFullYear() - 1;
        }
        
        if (str.includes('today') || str.includes('less than') || str.includes('hour') || str.includes('minute') || str.includes('second')) {
            return now.getFullYear();
        }
        
        return extractYear(relativeStr);
    }

    /**
     * Initialize yearly stats structure for a year
     */
    function initYear(year) {
        if (!yearlyStats[year]) {
            yearlyStats[year] = {
                creator: {
                    works: 0,
                    words: 0,
                    kudos: 0,
                    comments: 0,
                    hits: 0,
                    fandoms: {},
                    relationships: {},
                    tags: {},
                    topWorks: [],
                    commenters: {},
                    kudosGivers: {}
                },
                reader: {
                    fics: 0,
                    words: 0,
                    matureClicks: 0,
                    fandoms: {},
                    relationships: {},
                    tags: {},
                    workVisits: {},
                    authors: {} // Track favorite authors: { name: { works: [], visits: number, topWork: string, topWorkVisits: number } }
                }
            };
        }
    }
    
    /**
     * Parse AO3 date string to Date object
     */
    function parseAO3DateToDate(dateStr) {
        if (!dateStr) return null;
        
        const months = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const match1 = dateStr.match(/(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/);
        if (match1) {
            const day = parseInt(match1[1], 10);
            const month = months[match1[2].toLowerCase().substring(0, 3)];
            const year = parseInt(match1[3], 10);
            if (month !== undefined) {
                return new Date(year, month, day);
            }
        }
        
        const match2 = dateStr.match(/(\w{3})\w*\s+(\d{1,2}),?\s+(\d{4})/);
        if (match2) {
            const month = months[match2[1].toLowerCase().substring(0, 3)];
            const day = parseInt(match2[2], 10);
            const year = parseInt(match2[3], 10);
            if (month !== undefined) {
                return new Date(year, month, day);
            }
        }
        
        const match3 = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match3) {
            return new Date(parseInt(match3[1], 10), parseInt(match3[2], 10) - 1, parseInt(match3[3], 10));
        }
        
        const year = extractYear(dateStr);
        if (year) {
            return new Date(year, 0, 1);
        }
        
        return null;
    }
    
    /**
     * Calculate days in each year between two dates
     */
    // Optimized: O(years) instead of O(days) - no day-by-day iteration
    function calculateDaysPerYear(startDate, endDate) {
        const result = {};
        
        if (!startDate || !endDate || startDate > endDate) {
            if (startDate) {
                result[startDate.getFullYear()] = 1;
            }
            return result;
        }
        
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        
        for (let year = startYear; year <= endYear; year++) {
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            
            const rangeStart = year === startYear ? startDate : yearStart;
            const rangeEnd = year === endYear ? endDate : yearEnd;
            
            const days = Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
            if (days > 0) {
                result[year] = days;
            }
        }
        
        return result;
    }

    /**
     * Add to object counter
     */
    function addToCounter(obj, key, value = 1) {
        if (!key || key.trim() === '') return;
        const cleanKey = key.trim();
        obj[cleanKey] = (obj[cleanKey] || 0) + value;
    }
    
    /**
     * Clean relationship tag - remove "- Relationship" suffix
     */
    function cleanRelationshipTag(tag) {
        if (!tag) return tag;
        return tag.replace(/\s*-\s*Relationship$/i, '').trim();
    }
    
    /**
     * Extract AO3 logo from page and display in Journey header
     */
    function extractAO3Logo() {
        const logoContainer = document.getElementById('ao3-logo-container');
        if (!logoContainer) return;
        
        // Clear any existing content
        logoContainer.innerHTML = '';
        
        // Use AO3's logo URL directly (more reliable than cloning)
        const logoImg = document.createElement('img');
        logoImg.src = 'https://archiveofourown.org/images/ao3_logos/logo_42.png';
        logoImg.alt = 'AO3';
        logoImg.style.height = '36px';
        logoImg.style.width = 'auto';
        logoContainer.appendChild(logoImg);
    }

    /**
     * Update progress display
     */
    function updateProgress(status, detail = '', percent = null) {
        const statusEl = document.getElementById('progress-status');
        const detailEl = document.getElementById('progress-detail');
        const barEl = document.getElementById('progress-bar');
        
        if (statusEl) statusEl.textContent = status;
        if (detailEl) detailEl.textContent = detail;
        if (barEl && percent !== null) barEl.style.width = `${percent}%`;
    }

    // ==================== CACHING ====================
    
    /**
     * Load cached data from localStorage
     */
    function loadCache(username) {
        try {
            const raw = localStorage.getItem(CONFIG.CACHE_KEY);
            if (!raw) {
                debugLog('No cache found in localStorage');
                return null;
            }
            
            const cache = JSON.parse(raw);
            
            // Validate cache structure and version
            if (!cache || cache.version !== CONFIG.CACHE_VERSION) {
                debugLog('Cache version mismatch, invalidating');
                localStorage.removeItem(CONFIG.CACHE_KEY);
                return null;
            }
            
            // Check if cache belongs to same user
            if (cache.username !== username) {
                debugLog('Cache belongs to different user:', cache.username, 'vs', username);
                localStorage.removeItem(CONFIG.CACHE_KEY);
                return null;
            }
            
            debugLog('Loaded cache for user:', username, '| Years:', Object.keys(cache.data || {}));
            return cache;
        } catch (e) {
            console.warn('[AO3 Journey] Failed to load cache:', e);
            localStorage.removeItem(CONFIG.CACHE_KEY);
            return null;
        }
    }
    
    /**
     * Save data to cache
     */
    function saveCache(username, stats) {
        try {
            const cache = {
                version: CONFIG.CACHE_VERSION,
                username: username,
                savedAt: new Date().toISOString(),
                currentYear: new Date().getFullYear(),
                data: stats
            };
            
            const json = JSON.stringify(cache);
            
            // Check size before saving (localStorage limit is ~5MB)
            if (json.length > 4 * 1024 * 1024) {
                console.warn('[AO3 Journey] Cache too large, skipping save');
                return false;
            }
            
            localStorage.setItem(CONFIG.CACHE_KEY, json);
            debugLog('Cache saved successfully for user:', username);
            return true;
        } catch (e) {
            console.warn('[AO3 Journey] Failed to save cache:', e);
            return false;
        }
    }
    
    /**
     * Clear the cache
     */
    function clearCache() {
        localStorage.removeItem(CONFIG.CACHE_KEY);
        localStorage.removeItem(CONFIG.PROGRESS_KEY);
        debugLog('Cache cleared');
    }
    
    /**
     * Save scan progress for recovery
     */
    /**
     * Save scan progress for recovery
     * @param {string} username - The username
     * @param {string} stage - 'works', 'inbox', or 'history'
     * @param {number} pageNum - Current page number (or work index for works stage)
     * @param {object} stats - Current yearlyStats data
     * @param {object} extra - Extra data for works stage (workUrls array)
     */
    function saveProgress(username, stage, pageNum, stats, extra = null) {
        try {
            const progress = {
                version: CONFIG.CACHE_VERSION,
                username: username,
                savedAt: new Date().toISOString(),
                stage: stage, // 'works', 'inbox', 'history'
                lastPage: pageNum,
                data: stats,
                extra: extra // For works stage: { workUrls: [...], workIndex: n }
            };
            localStorage.setItem(CONFIG.PROGRESS_KEY, JSON.stringify(progress));
            debugLog(`Progress saved: ${stage} page/index ${pageNum}`);
        } catch (e) {
            console.warn('[AO3 Journey] Failed to save progress:', e);
        }
    }
    
    /**
     * Load incomplete scan progress
     */
    function loadProgress(username) {
        try {
            const raw = localStorage.getItem(CONFIG.PROGRESS_KEY);
            if (!raw) return null;
            
            const progress = JSON.parse(raw);
            
            // Validate
            if (!progress || progress.version !== CONFIG.CACHE_VERSION) {
                localStorage.removeItem(CONFIG.PROGRESS_KEY);
                return null;
            }
            
            if (progress.username !== username) {
                localStorage.removeItem(CONFIG.PROGRESS_KEY);
                return null;
            }
            
            // Check if progress is recent (within 24 hours)
            const savedTime = new Date(progress.savedAt).getTime();
            const now = Date.now();
            const hoursSinceSave = (now - savedTime) / (1000 * 60 * 60);
            
            if (hoursSinceSave > 24) {
                debugLog('Progress too old, discarding');
                localStorage.removeItem(CONFIG.PROGRESS_KEY);
                return null;
            }
            
            debugLog('Found incomplete scan:', progress.stage, 'page', progress.lastPage);
            return progress;
        } catch (e) {
            localStorage.removeItem(CONFIG.PROGRESS_KEY);
            return null;
        }
    }
    
    /**
     * Clear progress (call when scan completes successfully)
     */
    function clearProgress() {
        localStorage.removeItem(CONFIG.PROGRESS_KEY);
        debugLog('Progress cleared');
    }
    
    /**
     * Determine which years need scanning based on cache
     */
    function determineScanScope(username) {
        const cache = loadCache(username);
        const currentYear = new Date().getFullYear();
        
        if (!cache || !cache.data) {
            return {
                cachedData: null,
                cachedYears: [],
                yearsToScan: 'all'
            };
        }
        
        // Get years from cache (excluding current year - always rescan that)
        const cachedYearsList = Object.keys(cache.data)
            .map(y => parseInt(y, 10))
            .filter(y => y < currentYear);
        
        return {
            cachedData: cache.data,
            cachedYears: cachedYearsList,
            yearsToScan: [currentYear]
        };
    }

    // ==================== DATA FETCHERS ====================
    // (Same as Tampermonkey version - all the fetch functions)

    async function fetchCreatorWorks(username, targetYear = null, resumeData = null) {
        const baseUrl = `https://archiveofourown.org/users/${username}/works`;
        
        const yearLabel = targetYear ? ` (${targetYear} only)` : '';
        
        let workUrls = [];
        let startIndex = 0;
        
        // Check if resuming from saved work URLs
        if (resumeData && resumeData.workUrls && resumeData.workIndex !== undefined) {
            workUrls = resumeData.workUrls;
            startIndex = resumeData.workIndex + 1; // Start from next work
            debugLog(`📚 Resuming works scan from index ${startIndex} of ${workUrls.length}`);
            updateProgress('Resuming works scan...', `Starting from work ${startIndex + 1} of ${workUrls.length}${yearLabel}`, 5);
        } else {
            // Fresh scan - collect all work URLs
            updateProgress('Finding your works...', `Fetching works list${yearLabel}`, 2);
            
            const firstPage = await fetchPage(`${baseUrl}?page=1`);
            const totalPages = getTotalPages(firstPage);
            
            // Use date-aware collection for incremental scans
            collectWorkUrlsWithDates(firstPage, workUrls, targetYear);
            
            for (let page = 2; page <= totalPages; page++) {
                await sleep(CONFIG.REQUEST_DELAY);
                updateProgress('Finding your works...', `Scanning page ${page} of ${totalPages}${yearLabel}`, 2 + (page / totalPages) * 3);
                const doc = await fetchPage(`${baseUrl}?page=${page}`);
                collectWorkUrlsWithDates(doc, workUrls, targetYear);
            }
            
            debugLog(`📚 Found ${workUrls.length} works to scan${yearLabel}`);
            
            // Save initial progress with work URLs
            if (workUrls.length > 0) {
                saveProgress(username, 'works', -1, yearlyStats, { workUrls: workUrls, workIndex: -1 });
            }
        }
        
        // Now visit each work's individual page to get accurate dates
        for (let i = startIndex; i < workUrls.length; i++) {
            const workUrl = workUrls[i];
            await sleep(CONFIG.REQUEST_DELAY);
            
            const progress = 5 + (i / workUrls.length) * 15;
            updateProgress('Scanning your works...', `Work ${i + 1} of ${workUrls.length}${yearLabel}`, progress);
            
            try {
                await processIndividualWork(workUrl, targetYear);
            } catch (e) {
                console.warn(`[AO3 Journey] Failed to process work: ${workUrl}`, e);
            }
            
            // Save progress periodically (every SAVE_INTERVAL works)
            if ((i + 1) % CONFIG.SAVE_INTERVAL === 0) {
                saveProgress(username, 'works', i, yearlyStats, { workUrls: workUrls, workIndex: i });
            }
        }
        
        // Mark works stage complete
        debugLog('✅ Works scan complete');
    }
    
    function collectWorkUrls(doc, urlArray) {
        const workItems = doc.querySelectorAll('li.work.blurb');
        workItems.forEach(item => {
            const link = item.querySelector('h4.heading a:first-child');
            if (link && link.href) {
                urlArray.push(link.href);
            }
        });
    }
    
    /**
     * Collect work URLs with date filtering for incremental scans
     * @param {Document} doc - The page document
     * @param {Array} urlArray - Array to push URLs to
     * @param {number|null} targetYear - If set, only include works updated in this year or later
     */
    function collectWorkUrlsWithDates(doc, urlArray, targetYear = null) {
        const workItems = doc.querySelectorAll('li.work.blurb');
        workItems.forEach(item => {
            const link = item.querySelector('h4.heading a:first-child');
            if (!link || !link.href) return;
            
            // If no target year filter, include all
            if (!targetYear) {
                urlArray.push(link.href);
                return;
            }
            
            // Check the date on the work blurb
            // AO3 shows the last updated date in the datetime element
            const dateEl = item.querySelector('p.datetime');
            const dateText = dateEl?.textContent?.trim() || '';
            const workYear = extractYear(dateText);
            
            // Include work if it was updated in the target year or later
            // We'll do more precise filtering in processIndividualWork
            if (workYear && workYear >= targetYear) {
                urlArray.push(link.href);
                debugLog('   Including work (updated', workYear, '):', link.href);
            }
        });
    }
    
    async function processIndividualWork(workUrl, targetYear = null) {
        // Prevent processing the same work twice in one scan
        if (processedWorkUrls.has(workUrl)) {
            debugLog('⏭️ Skipping already processed work:', workUrl);
            return;
        }
        processedWorkUrls.add(workUrl);
        
        const doc = await fetchPage(workUrl);
        
        const publishedEl = doc.querySelector('dd.published');
        const pubDateStr = publishedEl?.textContent?.trim() || '';
        
        const statusEl = doc.querySelector('dd.status');
        const statusDateStr = statusEl?.textContent?.trim() || pubDateStr;
        
        const pubYear = extractYear(pubDateStr);
        const statusYear = extractYear(statusDateStr) || pubYear;
        
        if (!pubYear) {
            debugLog('⚠️ Could not find published date for:', workUrl);
            return;
        }
        
        // If targeting a specific year, check if this work is relevant
        if (targetYear !== null) {
            const minYear = Math.min(pubYear, statusYear);
            const maxYear = Math.max(pubYear, statusYear);
            if (targetYear < minYear || targetYear > maxYear) {
                // Work doesn't span target year, but still process for completeness
                // (stats will be allocated proportionally anyway)
            }
        }
        
        const titleEl = doc.querySelector('h2.title');
        const title = titleEl?.textContent?.trim() || 'Unknown Work';
        
        const wordsEl = doc.querySelector('dd.words');
        const kudosEl = doc.querySelector('dd.kudos');
        const commentsEl = doc.querySelector('dd.comments');
        const hitsEl = doc.querySelector('dd.hits');
        
        const words = parseInt(wordsEl?.textContent?.replace(/,/g, '') || '0', 10);
        const kudos = parseInt(kudosEl?.textContent?.replace(/,/g, '') || '0', 10);
        const comments = parseInt(commentsEl?.textContent?.replace(/,/g, '') || '0', 10);
        const hits = parseInt(hitsEl?.textContent?.replace(/,/g, '') || '0', 10);
        
        const fandoms = Array.from(doc.querySelectorAll('dd.fandom a.tag')).map(a => a.textContent?.trim());
        const relationships = Array.from(doc.querySelectorAll('dd.relationship a.tag')).map(a => a.textContent?.trim());
        const freeformTags = Array.from(doc.querySelectorAll('dd.freeform a.tag'))
            .map(a => a.textContent?.trim())
            .filter(tag => !ARCHIVE_WARNINGS.includes(tag));
        
        let kudosGivers = [];
        
        const kudosP = doc.querySelector('#kudos');
        if (kudosP) {
            kudosGivers = Array.from(kudosP.querySelectorAll('a[href*="/users/"]'))
                .map(a => a.textContent?.trim())
                .filter(name => name && name.length > 0);
        }
        
        if (kudosGivers.length === 0) {
            const kudosAlt = doc.querySelector('p.kudos, span.kudos, div.kudos');
            if (kudosAlt) {
                kudosGivers = Array.from(kudosAlt.querySelectorAll('a[href*="/users/"]'))
                    .map(a => a.textContent?.trim())
                    .filter(name => name && name.length > 0);
            }
        }
        
        if (kudosGivers.length === 0) {
            const allPs = doc.querySelectorAll('p');
            for (const p of allPs) {
                if (p.textContent?.includes('left kudos on this work')) {
                    kudosGivers = Array.from(p.querySelectorAll('a[href*="/users/"]'))
                        .map(a => a.textContent?.trim())
                        .filter(name => name && name.length > 0);
                    break;
                }
            }
        }
        
        debugLog('📝 WORK:', title);
        debugLog('   Published:', pubYear, '| Updated:', statusYear);
        debugLog('   Stats:', { words, kudos, comments, hits });
        
        const pubDate = parseAO3DateToDate(pubDateStr);
        const statusDate = parseAO3DateToDate(statusDateStr) || pubDate;
        
        const daysPerYear = calculateDaysPerYear(pubDate, statusDate);
        const totalDays = Object.values(daysPerYear).reduce((sum, d) => sum + d, 0);
        
        // Only store debug info when debugging is enabled
        if (CONFIG.DEBUG_MODE) {
            allWorksDebug.push({
                title,
                url: workUrl,
                publishedYear: pubYear,
                statusYear: statusYear,
                words,
                kudos,
                comments,
                hits
            });
        }
        
        Object.entries(daysPerYear).forEach(([yearStr, days]) => {
            const year = parseInt(yearStr, 10);
            
            // Skip cached years during incremental scan - only update target year
            if (targetYear !== null && year !== targetYear) {
                return; // Skip this year - it's already in cache
            }
            
            const proportion = days / totalDays;
            
            initYear(year);
            const c = yearlyStats[year].creator;
            
            const allocatedWords = Math.round(words * proportion);
            const allocatedKudos = Math.round(kudos * proportion);
            const allocatedComments = Math.round(comments * proportion);
            const allocatedHits = Math.round(hits * proportion);
            
            c.works++;
            c.words += allocatedWords;
            c.kudos += allocatedKudos;
            c.comments += allocatedComments;
            c.hits += allocatedHits;
            
            // Check for duplicate before adding to topWorks
            const existingWork = c.topWorks.find(w => w.url === workUrl);
            if (!existingWork) {
                c.topWorks.push({
                    title,
                    url: workUrl,
                    kudos,
                    comments,
                    hits,
                    score: kudos + comments * 2
                });
            }
            
            fandoms.forEach(f => addToCounter(c.fandoms, f, allocatedWords));
            relationships.forEach(r => addToCounter(c.relationships, r, allocatedWords));
            freeformTags.forEach(t => addToCounter(c.tags, t, 1));
            
            kudosGivers.forEach(giver => addToCounter(c.kudosGivers, giver, 1));
        });
    }

    async function fetchInboxComments(username, targetYear = null, startPage = 1) {
        const baseUrl = `https://archiveofourown.org/users/${username}/inbox`;
        
        const yearLabel = targetYear ? ` (${targetYear} only)` : '';
        const resumeLabel = startPage > 1 ? ` (resuming from page ${startPage})` : '';
        updateProgress('Scanning your inbox...', `Fetching page ${startPage}${yearLabel}${resumeLabel}`, 25);
        
        try {
            const firstPage = await fetchPage(`${baseUrl}?page=${startPage}`);
            const totalPages = Math.min(getTotalPages(firstPage), CONFIG.MAX_INBOX_PAGES);
            
            let shouldStop = processInboxPage(firstPage, username, targetYear);
            
            // Save initial progress
            if (startPage === 1) {
                saveProgress(username, 'inbox', 1, yearlyStats);
            }
            
            for (let page = startPage + 1; page <= totalPages; page++) {
                // Early termination: stop scanning if we've hit entries older than target year
                if (shouldStop && targetYear) {
                    debugLog(`💬 Stopping inbox scan at page ${page} - found entries older than ${targetYear}`);
                    break;
                }
                
                await sleep(CONFIG.REQUEST_DELAY);
                updateProgress('Scanning your inbox...', `Fetching page ${page} of ${totalPages}${yearLabel}`, 25 + (page / totalPages) * 15);
                
                const doc = await fetchPage(`${baseUrl}?page=${page}`);
                shouldStop = processInboxPage(doc, username, targetYear);
                
                // Save progress periodically
                if (page % CONFIG.SAVE_INTERVAL === 0) {
                    saveProgress(username, 'inbox', page, yearlyStats);
                }
            }
        } catch (e) {
            console.warn('[AO3 Journey] Inbox scan failed:', e);
        }
    }

    /**
     * Process inbox page to extract commenter data
     * @param {Document} doc - The page document
     * @param {string} myUsername - Current user's username
     * @param {number|null} targetYear - If set, only count comments from this year
     * @returns {boolean} - True if we found entries older than targetYear (signal to stop scanning)
     */
    function processInboxPage(doc, myUsername, targetYear = null) {
        const commentItems = doc.querySelectorAll('li.comment, li[role="article"], #inbox li, .inbox li');
        const items = commentItems.length > 0 ? commentItems : doc.querySelectorAll('#main li');
        let foundOlderEntry = false;
        
        const BLOCKED_NAMES = [
            'Reply', 'Delete', 'Edit', 'Spam', 'Select', 'Mark Read', 'Mark Unread',
            'Delete From Inbox', 'Select All', 'Select None',
            'Dashboard', 'Profile', 'Preferences', 'Skins', 'Works', 'Drafts', 
            'Series', 'Bookmarks', 'Collections', 'Inbox', 'Statistics', 
            'History', 'Subscriptions', 'Sign-ups', 'Assignments', 'Claims',
            'Previous', 'Next', 'Log In', 'Log Out', 'Sign Up',
            'Anonymous', 'Guest',
        ];
        
        items.forEach(item => {
            const headingEl = item.querySelector('h4.heading');
            if (!headingEl) return;
            
            const authorLink = headingEl.querySelector('a[href*="/users/"]');
            if (!authorLink) return;
            
            const commenterName = authorLink.textContent?.trim();
            
            if (!commenterName || commenterName === myUsername) return;
            
            if (BLOCKED_NAMES.some(blocked => 
                commenterName.toLowerCase() === blocked.toLowerCase())) {
                return;
            }
            
            if (commenterName.length < 2) return;
            
            const timeText = item.textContent || '';
            const relativeTimeMatch = timeText.match(/(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago|yesterday|today|a\s+(?:day|week|month|year)\s*ago|less than)/i);
            
            let year = null;
            
            if (relativeTimeMatch) {
                year = parseRelativeTime(relativeTimeMatch[0]);
            } else {
                year = extractYear(timeText);
            }
            
            if (!year) {
                year = new Date().getFullYear();
            }
            
            // Skip if not in target year (for incremental scans)
            if (targetYear !== null && year !== targetYear) {
                if (year < targetYear) {
                    foundOlderEntry = true;
                }
                return;
            }
            
            initYear(year);
            addToCounter(yearlyStats[year].creator.commenters, commenterName, 1);
        });
        
        return foundOlderEntry;
    }

    async function fetchReadingHistory(username, targetYear = null, startPage = 1) {
        const baseUrl = `https://archiveofourown.org/users/${username}/readings`;
        
        const yearLabel = targetYear ? ` (${targetYear} only)` : '';
        const resumeLabel = startPage > 1 ? ` (resuming from page ${startPage})` : '';
        updateProgress('Scanning reading history...', `Fetching page ${startPage}${yearLabel}${resumeLabel}`, 45);
        
        const firstPage = await fetchPage(`${baseUrl}?page=${startPage}`);
        const totalPages = getTotalPages(firstPage);
        
        let shouldStop = processReadingsPage(firstPage, targetYear);
        
        // Save initial progress
        if (startPage === 1) {
            saveProgress(username, 'history', 1, yearlyStats);
        }
        
        for (let page = startPage + 1; page <= totalPages; page++) {
            // Early termination: stop scanning if we've hit entries older than target year
            if (shouldStop && targetYear) {
                debugLog(`📖 Stopping reading history scan at page ${page} - found entries older than ${targetYear}`);
                updateProgress('Scanning reading history...', `Done! Stopped at page ${page-1} (older entries skipped)`, 95);
                break;
            }
            
            await sleep(CONFIG.REQUEST_DELAY);
            updateProgress('Scanning reading history...', `Fetching page ${page} of ${totalPages}${yearLabel}`, 45 + (page / totalPages) * 50);
            
            const doc = await fetchPage(`${baseUrl}?page=${page}`);
            shouldStop = processReadingsPage(doc, targetYear);
            
            // Save progress periodically
            if (page % CONFIG.SAVE_INTERVAL === 0) {
                saveProgress(username, 'history', page, yearlyStats);
            }
        }
    }

    /**
     * Process reading history page
     * @param {Document} doc - The page document
     * @param {number|null} targetYear - If set, only count readings from this year
     * @returns {boolean} - True if we found entries older than targetYear (signal to stop scanning)
     */
    function processReadingsPage(doc, targetYear = null) {
        const items = doc.querySelectorAll('li.reading');
        let foundOlderEntry = false;
        
        items.forEach(item => {
            // Get the "Last visited" heading which contains the date
            const viewedHeading = item.querySelector('h4.viewed.heading');
            const viewedText = viewedHeading?.textContent || '';
            
            // Extract year from "Last visited: 25 Dec 2024"
            const year = extractYear(viewedText);
            if (!year) return;
            
            // Skip if not in target year (for incremental scans)
            if (targetYear !== null && year !== targetYear) {
                // If this entry is older than target year, mark for early termination
                if (year < targetYear) {
                    foundOlderEntry = true;
                }
                return;
            }
            
            initYear(year);
            const r = yearlyStats[year].reader;
            
            const visitMatch = viewedText.match(/Visited\s+(\d+)\s+time/i);
            const visits = visitMatch ? parseInt(visitMatch[1], 10) : 1;
            
            const titleLink = item.querySelector('h4.heading a:first-child');
            const title = titleLink?.textContent?.trim() || 'Unknown Work';
            const workUrl = titleLink?.href || '#';
            
            // Check if this work was already counted in this year
            const isNewWork = !r.workVisits[title];
            
            if (!r.workVisits[title]) {
                r.workVisits[title] = { visits: 0, url: workUrl };
            }
            r.workVisits[title].visits += visits;
            
            // Only count fics and words once per unique work
            if (isNewWork) {
                r.fics++;
                const words = parseInt(item.querySelector('dd.words')?.textContent?.replace(/,/g, '') || '0', 10);
                r.words += words;
            }
            
            const ratingTag = item.querySelector('span.rating');
            const ratingText = ratingTag?.textContent?.trim()?.toLowerCase() || '';
            const isMatureOrExplicit = ratingText.includes('mature') || ratingText.includes('explicit') ||
                                       item.textContent?.includes('Mature') || item.textContent?.includes('Explicit');
            if (isMatureOrExplicit) {
                r.matureClicks += visits;
            }
            
            // Extract author name for favorite author tracking
            const authorLink = item.querySelector('h4.heading a[rel="author"]');
            const authorName = authorLink?.textContent?.trim();
            
            if (authorName) {
                if (!r.authors[authorName]) {
                    r.authors[authorName] = {
                        works: [],  // Changed from Set to Array for JSON serialization
                        visits: 0,
                        topWork: null,
                        topWorkVisits: 0
                    };
                }
                // Add work to array if not already present
                if (!r.authors[authorName].works.includes(title)) {
                    r.authors[authorName].works.push(title);
                }
                r.authors[authorName].visits += visits;
                
                // Track top work for this author
                if (visits > (r.authors[authorName].topWorkVisits || 0)) {
                    r.authors[authorName].topWork = title;
                    r.authors[authorName].topWorkVisits = visits;
                }
            }
            
            const fandoms = Array.from(item.querySelectorAll('h5.fandoms a.tag')).map(a => a.textContent?.trim());
            const relationships = Array.from(item.querySelectorAll('li.relationships a.tag')).map(a => a.textContent?.trim());
            const freeformTags = Array.from(item.querySelectorAll('li.freeforms a.tag'))
                .map(a => a.textContent?.trim())
                .filter(tag => !ARCHIVE_WARNINGS.includes(tag));
            
            fandoms.forEach(f => addToCounter(r.fandoms, f, 1));
            relationships.forEach(rel => addToCounter(r.relationships, rel, 1));
            freeformTags.forEach(t => addToCounter(r.tags, t, 1));
        });
        
        return foundOlderEntry;
    }

    // ==================== MAIN SCAN ====================

    async function startScan(forceFullScan = false) {
        if (isScanning) {
            debugLog('Already scanning, skipping...');
            return;
        }
        isScanning = true;
        isIncrementalScan = false;
        cachedYears = [];
        
        debugLog('🚀 Starting scan...', forceFullScan ? '(FULL)' : '(checking cache)');
        
        // Force UI update immediately
        const progressView = document.getElementById('progress-view');
        const progressTitle = document.getElementById('progress-title');
        const progressStatus = document.getElementById('progress-status');
        
        if (progressTitle) progressTitle.innerHTML = '正在创建你的AO3年度报告<span class="dots"></span>';
        if (progressStatus) progressStatus.textContent = '正在准备...';
        
        // Reset stats
        yearlyStats = {};
        allWorksDebug = [];
        processedWorkUrls = new Set(); // Reset processed URLs tracker
        
        // Small delay to ensure UI updates (Safari needs this)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        let username = null;
        try {
            username = getLoggedInUsername();
            debugLog('Username found:', username);
        } catch (e) {
            debugLog('Error getting username:', e);
        }
        
        // Update the title with username
        const titleEl = document.getElementById('journey-title');
        if (titleEl && username) {
            titleEl.textContent = `AO3 Journey for ${username}`;
        }
        
        if (!username) {
            // Show a user-friendly error for not logged in
            if (progressView) {
                progressView.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
                        <div style="font-size: 1.3em; font-weight: 700; color: #990000; margin-bottom: 15px;">
                            请先登录 AO3
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 20px; line-height: 1.6;">
                            Please log in to AO3 first to view your journey.<br>
                            点击右上角的 "Log In" 登录后再试。
                        </div>
                        <a href="https://archiveofourown.org/users/login" 
                           style="display: inline-block; background: linear-gradient(135deg, #990000 0%, #cc0000 100%); 
                                  color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; 
                                  font-weight: bold; font-size: 14px;">
                            Log In to AO3
                        </a>
                    </div>
                `;
            }
            debugLog('❌ No username found - user is not logged in');
            isScanning = false;
            return;
        }
        
        try {
            const currentYear = new Date().getFullYear();
            let scanScope;
            let resumeProgress = null;
            let resumeStartPage = 1;
            let resumeStage = null;
            
            // Check for incomplete scan progress (unless forcing full scan)
            if (!forceFullScan) {
                resumeProgress = loadProgress(username);
                
                if (resumeProgress) {
                    // Found incomplete scan - offer to resume
                    const resumeChoice = confirm(
                        `🔄 发现未完成的扫描\nFound incomplete scan from ${new Date(resumeProgress.savedAt).toLocaleString()}\n\n` +
                        `Stage: ${resumeProgress.stage}, Page: ${resumeProgress.lastPage}\n\n` +
                        `点击 "确定" 继续扫描，或 "取消" 重新开始\n` +
                        `Click OK to resume, or Cancel to start fresh`
                    );
                    
                    if (resumeChoice) {
                        // Resume from saved progress
                        debugLog('📥 Resuming from saved progress:', resumeProgress.stage, 'page', resumeProgress.lastPage);
                        yearlyStats = resumeProgress.data || {};
                        resumeStage = resumeProgress.stage;
                        resumeStartPage = resumeProgress.lastPage + 1;
                        updateProgress('恢复扫描进度...', `Resuming from ${resumeProgress.stage} page ${resumeProgress.lastPage}...`, 10);
                        await sleep(300);
                    } else {
                        // User chose to start fresh
                        clearProgress();
                        resumeProgress = null;
                    }
                }
            }
            
            // Check cache unless forcing full scan or resuming
            if (!forceFullScan && !resumeProgress) {
                scanScope = determineScanScope(username);
                
                if (scanScope.cachedData) {
                    // Load cached data for past years
                    debugLog('📦 Loading cached data for years:', scanScope.cachedYears);
                    updateProgress('加载缓存数据...', 'Loading cached data...', 5);
                    
                    // Copy cached years into yearlyStats
                    for (const year of scanScope.cachedYears) {
                        if (scanScope.cachedData[year]) {
                            yearlyStats[year] = scanScope.cachedData[year];
                        }
                    }
                    
                    cachedYears = scanScope.cachedYears;
                    isIncrementalScan = true;
                    
                    debugLog('✅ Loaded', cachedYears.length, 'years from cache');
                    debugLog('🔄 Will scan current year:', currentYear);
                    
                    await sleep(300);
                }
            } else if (forceFullScan) {
                debugLog('🔄 Force full scan requested - ignoring cache');
                clearCache();
            }
            
            // Update progress message based on scan type
            if (isIncrementalScan) {
                updateProgress(`扫描 ${currentYear} 年数据...`, `Scanning ${currentYear} data (${cachedYears.length} years cached)`, 10);
                // IMPORTANT: Reset current year's data to avoid accumulation
                delete yearlyStats[currentYear];
                debugLog(`🧹 Reset ${currentYear} data to avoid accumulation`);
            } else if (!resumeProgress) {
                updateProgress('扫描所有数据...', 'Scanning all data...', 5);
            }
            
            // Determine which stages to run based on resume state
            // Stage order: works -> inbox -> history
            // If resuming from a stage, skip all previous stages (they're complete)
            const targetYear = isIncrementalScan ? currentYear : null;
            
            // Fetch creator works (skip if resuming from inbox or history)
            if (!resumeStage || resumeStage === 'works') {
                debugLog('📚 Starting to fetch creator works...');
                // Check if resuming works stage with saved work URLs
                const worksResumeData = (resumeStage === 'works' && resumeProgress?.extra) 
                    ? resumeProgress.extra 
                    : null;
                await fetchCreatorWorks(username, targetYear, worksResumeData);
            } else {
                debugLog(`⏭️ Skipping works stage (resuming from ${resumeStage})`);
            }
            
            // Fetch inbox comments (skip if resuming from history)
            if (!resumeStage || resumeStage === 'works' || resumeStage === 'inbox') {
                debugLog('📬 Starting to fetch inbox comments...');
                const inboxStartPage = (resumeStage === 'inbox') ? resumeStartPage : 1;
                await fetchInboxComments(username, targetYear, inboxStartPage);
            } else if (resumeStage === 'history') {
                debugLog('⏭️ Skipping inbox stage (resuming from history)');
            }
            
            // Fetch reading history (always run, may resume from specific page)
            debugLog('📖 Starting to fetch reading history...');
            const historyStartPage = (resumeStage === 'history') ? resumeStartPage : 1;
            await fetchReadingHistory(username, targetYear, historyStartPage);
            
            updateProgress('正在生成报告...', 'Almost done!', 98);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Save to cache after successful scan
            saveCache(username, yearlyStats);
            clearProgress(); // Clear incremental progress - scan completed successfully
            debugLog('💾 Data saved to cache');
            
            debugLog('✅ SCAN COMPLETE');
            debugLog('Years found:', Object.keys(yearlyStats).sort());
            
            if (CONFIG.DEBUG_MODE) {
                window.ao3JourneyData = yearlyStats;
                window.ao3WorksDebug = allWorksDebug;
            }
            
            renderResults();
        } catch (error) {
            console.error('[AO3 Journey] Scan failed:', error);
            debugLog('❌ Scan error:', error.message, error.stack);
            updateProgress('扫描出错', error.message);
        }
        
        isScanning = false;
    }
    
    // Alias for backwards compatibility
    async function startFullScan() {
        return startScan(false);
    }

    // ==================== RENDERING ====================
    // (Same rendering functions as Tampermonkey version)

    function renderTopItems(obj, limit = 3, formatValue = null) {
        const sorted = Object.entries(obj)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        
        if (sorted.length === 0) {
            return '<div class="empty-state">No data yet</div>';
        }
        
        return sorted.map(([name, value]) => {
            const displayValue = formatValue ? formatValue(value) : value;
            return `<div class="list-item">
                <span class="list-item-title">${escapeHtml(name)}</span>
                <span class="list-item-value">${displayValue}</span>
            </div>`;
        }).join('');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatWords(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    }

    function renderConfirmationUI(year = 2025) {
        return `
            <div class="report-confirm-view active" data-year="confirm-${year}">
                <div class="confirm-container">
                    <div class="confirm-branding">
                        <img src="https://archiveofourown.org/images/ao3_logos/logo_42.png" alt="AO3" class="confirm-branding-logo">
                        <span class="confirm-branding-text">Archive of Our Own</span>
                    </div>
                    <div class="confirm-warning-box">
                        <div class="confirm-warning-text">
                            This work could have adult content. If you continue, you have agreed that you are willing to see such content.
                        </div>
                    </div>
                    
                    <div class="confirm-buttons">
                        <button class="confirm-btn yes" id="confirm-yes-btn">Yes, Continue</button>
                        <button class="confirm-btn no" id="confirm-no-btn">No, Go Back</button>
                    </div>
                    
                    <div class="confirm-subtitle">
                        If you accept cookies from our site and you choose "Yes, Continue", you will not be asked again during this session (that is, until you close your browser). If you log in you can store your preference and never be asked again.
                    </div>
                </div>
            </div>
        `;
    }

    function renderAnnualReport(year = 2025, username = '') {
        const stats = yearlyStats[year];
        if (!stats) return '';
        
        const c = stats.creator;
        const r = stats.reader;
        
        const allYears = Object.keys(yearlyStats).map(y => parseInt(y, 10)).sort((a, b) => a - b);
        const firstYear = allYears[0];
        const currentYear = new Date().getFullYear();
        const yearsOnAO3 = currentYear - firstYear + 1;
        
        const hasCreatorData = c && c.works > 0;
        let A = '—', B = 0, C = 0, D = '0.0', E = 0, F = 0, G = '—', H = 0, I = 0;
        let R = 0, S = 0, T = '0.0';
        
        if (hasCreatorData) {
            const topRelationship = Object.entries(c.relationships || {}).sort((a, b) => b[1] - a[1])[0];
            A = topRelationship ? cleanRelationshipTag(topRelationship[0]) : '—';
            S = topRelationship ? topRelationship[1] : 0;
            T = (S / 27000).toFixed(1);
            
            if (topRelationship && c.words > 0) {
                R = Math.max(1, Math.round(c.works * (S / c.words)));
            }
            
            B = c.works;
            C = c.words;
            D = (C / 60000).toFixed(1);
            E = c.kudos;
            F = c.comments;
            
            const topCommenter = Object.entries(c.commenters || {}).sort((a, b) => b[1] - a[1])[0];
            G = topCommenter ? topCommenter[0] : '—';
            I = topCommenter ? topCommenter[1] : 0;
            
            H = (c.kudosGivers && c.kudosGivers[G]) ? c.kudosGivers[G] : 0;
        }
        
        let U = '—', V = 0, W = 0, X = 0;
        if (hasCreatorData && c.topWorks && c.topWorks.length > 0) {
            const worksMap = new Map();
            c.topWorks.forEach(w => {
                if (!worksMap.has(w.title) || worksMap.get(w.title).kudos < w.kudos) {
                    worksMap.set(w.title, w);
                }
            });
            const sortedByKudos = Array.from(worksMap.values()).sort((a, b) => b.kudos - a.kudos);
            if (sortedByKudos.length > 0) {
                const topWork = sortedByKudos[0];
                U = topWork.title;
                V = topWork.hits || 0;
                W = topWork.kudos || 0;
                X = topWork.comments || 0;
            }
        }
        
        const J = r.fics;
        const K = r.words;
        const L = (K / 1000000).toFixed(1);
        const M = r.matureClicks;
        const N = (M / 5354).toFixed(1);
        
        const topReaderRelationship = Object.entries(r.relationships || {}).sort((a, b) => b[1] - a[1])[0];
        const O = topReaderRelationship ? cleanRelationshipTag(topReaderRelationship[0]) : '—';
        const P = topReaderRelationship ? topReaderRelationship[1] : 0;
        
        // Calculate favorite author (Y, Z, AA, AB, AC)
        let Y = '—', Z = 0, AA = 0, AB = '—', AC = 0;
        const authorEntries = Object.entries(r.authors || {});
        if (authorEntries.length > 0) {
            // Sort by total visits descending
            const sortedAuthors = authorEntries.sort((a, b) => b[1].visits - a[1].visits);
            const topAuthor = sortedAuthors[0];
            if (topAuthor) {
                Y = topAuthor[0]; // Author name
                Z = topAuthor[1].works ? (Array.isArray(topAuthor[1].works) ? topAuthor[1].works.length : 0) : 0; // Number of works
                AA = topAuthor[1].visits || 0; // Total visits
                AB = topAuthor[1].topWork || '—'; // Most visited work by this author
                AC = topAuthor[1].topWorkVisits || 0; // Visits to top work
            }
        }
        
        // Build Page 1 content (Creator or Reader if no creator)
        const page1Content = hasCreatorData ? `
            <div class="page-label">✍️ 创作者报告</div>
            <div class="report-section creator" style="flex: 1;">
                <div class="report-text">
                    <span class="report-emoji">✍️</span> ${year}年，你开了 <span class="nowrap"><span class="report-highlight pink">${B}</span> 个坑</span>，写下了 <span class="nowrap"><span class="report-number">${C.toLocaleString()}</span> 字</span>，相当于 <span class="nowrap"><span class="report-highlight">${D}</span> 本</span>《朝花夕拾》！
                </div>
                
                <div class="report-divider"></div>
                
                <div class="report-text">
                    <span class="report-emoji">💕</span> 你用情最深的cp是 <span class="report-highlight pink">${escapeHtml(A)}</span>，你为它写了 <span class="nowrap"><span class="report-highlight">${R}</span> 个</span>故事，<span class="nowrap"><span class="report-number">${S.toLocaleString()}</span> 字</span>，相当于 <span class="nowrap"><span class="report-highlight">${T}</span> 本</span>《老人与海》
                </div>
                
                <div class="report-divider"></div>
                
                ${(E > 0 || F > 0) ? `
                <div class="report-text">
                    <span class="report-emoji">❤️</span> ${E > 0 && F > 0 ? `你收到了 <span class="nowrap"><span class="report-number">${E.toLocaleString()}</span> 个Kudos</span>，<span class="nowrap"><span class="report-number">${F.toLocaleString()}</span> 条评论</span>` : E > 0 ? `你收到了 <span class="nowrap"><span class="report-number">${E.toLocaleString()}</span> 个Kudos</span>` : `你收到了 <span class="nowrap"><span class="report-number">${F.toLocaleString()}</span> 条评论</span>`}
                </div>
                ` : ''}
                
                ${U !== '—' ? `
                <div class="report-text">
                    <span class="report-emoji">🏆</span> 你最受欢迎的作品是《<span class="report-highlight pink">${escapeHtml(U)}</span>》，这个故事被翻开过 <span class="nowrap"><span class="report-number">${V.toLocaleString()}</span> 次</span>，${X > 0 ? `<span class="nowrap">有 <span class="report-highlight">${W}</span> 个人留下了Kudos</span>，收获了 <span class="nowrap"><span class="report-highlight">${X}</span> 条评论</span>` : `<span class="nowrap">有 <span class="report-highlight">${W}</span> 个人都很热爱你的作品，留下了Kudos</span>`}
                </div>
                ` : ''}
                
                ${G !== '—' ? `
                <div class="report-text">
                    <span class="report-emoji">🥰</span> 最爱你的读者是 <span class="report-highlight green">${escapeHtml(G)}</span>，Ta留下了 <span class="nowrap"><span class="report-highlight">${H}</span> 个Kudos</span>，<span class="nowrap"><span class="report-highlight">${I}</span> 条评论</span>
                </div>
                ` : ''}
                
                <div class="report-divider"></div>
                
                <div class="report-text report-closing" style="text-align: center; font-size: 17px;">
                    <span class="report-emoji">🏠</span> 今年，你也撑起了这个家！<span class="report-emoji">🏠</span>
                </div>
            </div>
            <div class="report-footer" style="margin-top: auto;">
                <div class="report-decoration">✦ ✦ ✦</div>
                <div class="report-quote">到了八十岁，也要继续搞同人！</div>
                <div class="report-blessing">愿你永远热爱，永远自由</div>
                <div class="report-decoration-end">🌸</div>
            </div>
        ` : `
            <div class="page-label">📖 阅读者报告</div>
            <div class="report-section reader" style="flex: 1;">
                <div class="report-text">
                    <span class="report-emoji">📚</span> ${year}年，你一共阅读了 <span class="nowrap"><span class="report-number">${J.toLocaleString()}</span> 篇</span>作品，<span class="nowrap"><span class="report-number">${K.toLocaleString()}</span> 字</span>，相当于 <span class="nowrap"><span class="report-highlight blue">${L}</span> 本</span>《红楼梦》
                </div>
                
                <div class="report-divider"></div>
                
                <div class="report-text">
                    <span class="report-emoji">🚗</span> 你点击了 <span class="nowrap"><span class="report-number">${M.toLocaleString()}</span> 次</span><span style="font-weight:700; color:#000; font-size:1.1em;">"Yes, Continue"</span>！
                </div>
                
                ${O !== '—' ? `
                <div class="report-divider"></div>
                <div class="report-text">
                    <span class="report-emoji">💘</span> 你的年度cp是 <span class="report-highlight pink">${escapeHtml(O)}</span>，你参与了他们的故事 <span class="nowrap"><span class="report-number">${P}</span> 次</span>。现在，你还爱他们吗？
                </div>
                ` : ''}
                
                ${Y !== '—' ? `
                <div class="report-divider"></div>
                <div class="report-text">
                    <span class="report-emoji">👩‍🏫</span> 今年你最爱的老师是 <span class="report-highlight green">${escapeHtml(Y)}</span>，你阅读了Ta的 <span class="nowrap"><span class="report-highlight">${Z}</span> 部</span>作品 <span class="nowrap"><span class="report-number">${AA}</span> 次</span>，你最爱的是Ta的《<span class="report-highlight pink">${escapeHtml(AB)}</span>》，反复观看了 <span class="nowrap"><span class="report-number">${AC}</span> 次</span>！
                </div>
                ` : ''}
                
                <div class="report-divider"></div>
                
                <div class="report-text report-closing" style="text-align: center; font-size: 17px;">
                    <span class="report-emoji">💪</span> 女人，就是要多看这些才有力气讨生活啊 <span class="report-emoji arm-emoji">💪</span>
                </div>
            </div>
            <div class="report-footer" style="margin-top: auto;">
                <div class="report-decoration">✦ ✦ ✦</div>
                <div class="report-quote">到了八十岁，也要继续搞同人！</div>
                <div class="report-blessing">愿你永远热爱，永远自由</div>
                <div class="report-decoration-end">🌸</div>
            </div>
        `;
        
        // Build Page 2 content (Reader if has creator, or empty)
        const page2Content = hasCreatorData ? `
            <div class="page-label">📖 阅读者报告</div>
            <div class="report-section reader" style="flex: 1;">
                <div class="report-text">
                    <span class="report-emoji">📚</span> ${year}年，你一共阅读了 <span class="nowrap"><span class="report-number">${J.toLocaleString()}</span> 篇</span>作品，<span class="nowrap"><span class="report-number">${K.toLocaleString()}</span> 字</span>，相当于 <span class="nowrap"><span class="report-highlight blue">${L}</span> 本</span>《红楼梦》
                </div>
                
                <div class="report-divider"></div>
                
                <div class="report-text">
                    <span class="report-emoji">🚗</span> 你点击了 <span class="nowrap"><span class="report-number">${M.toLocaleString()}</span> 次</span><span style="font-weight:700; color:#000; font-size:1.1em;">"Yes, Continue"</span>！
                </div>
                
                ${O !== '—' ? `
                <div class="report-divider"></div>
                <div class="report-text">
                    <span class="report-emoji">💘</span> 你的年度cp是 <span class="report-highlight pink">${escapeHtml(O)}</span>，你参与了他们的故事 <span class="nowrap"><span class="report-number">${P}</span> 次</span>。现在，你还爱他们吗？
                </div>
                ` : ''}
                
                ${Y !== '—' ? `
                <div class="report-divider"></div>
                <div class="report-text">
                    <span class="report-emoji">👩‍🏫</span> 今年你最爱的老师是 <span class="report-highlight green">${escapeHtml(Y)}</span>，你阅读了Ta的 <span class="nowrap"><span class="report-highlight">${Z}</span> 部</span>作品 <span class="nowrap"><span class="report-number">${AA}</span> 次</span>，你最爱的是Ta的《<span class="report-highlight pink">${escapeHtml(AB)}</span>》，反复观看了 <span class="nowrap"><span class="report-number">${AC}</span> 次</span>！
                </div>
                ` : ''}
                
                <div class="report-divider"></div>
                
                <div class="report-text report-closing" style="text-align: center; font-size: 17px;">
                    <span class="report-emoji">💪</span> 女人，就是要多看这些才有力气讨生活啊 <span class="report-emoji arm-emoji">💪</span>
                </div>
            </div>
            <div class="report-footer" style="margin-top: auto;">
                <div class="report-decoration">✦ ✦ ✦</div>
                <div class="report-quote">到了八十岁，也要继续搞同人！</div>
                <div class="report-blessing">愿你永远热爱，永远自由</div>
                <div class="report-decoration-end">🌸</div>
            </div>
        ` : '';
        
        // Determine if we need 2 pages
        const hasTwoPages = hasCreatorData;
        
        return `
            <div class="annual-report-view" data-year="annual-${year}">
                <div class="annual-report-wrapper">
                    <div class="annual-report-container" tabindex="0">
                        <!-- AO3 Branding -->
                        <div class="report-branding">
                            <img src="https://archiveofourown.org/images/ao3_logos/logo_42.png" alt="AO3" class="report-branding-logo">
                            <span class="report-branding-text">Archive of Our Own</span>
                        </div>
                        <!-- Fixed Header -->
                        <div class="report-header">
                            <div class="report-year">${year}</div>
                            <div class="report-subtitle">年 度 报 告</div>
                            <div class="years-badge">
                                <span class="report-emoji">✨</span>
                                ${username ? `<strong>${username}</strong>，` : ''}这是你在AO3的第 <span class="report-number">${yearsOnAO3}</span> 年
                                <span class="report-emoji">✨</span>
                            </div>
                        </div>
                        
                        <!-- Swipeable Carousel -->
                        <div class="report-carousel" data-pages="${hasTwoPages ? 2 : 1}">
                        <div class="report-carousel-track">
                            <div class="report-page" data-page="1">
                                ${page1Content}
                            </div>
                            ${hasTwoPages ? `
                            <div class="report-page" data-page="2">
                                ${page2Content}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${hasTwoPages ? `
                    <!-- Page Indicators -->
                    <div class="page-indicators">
                        <div class="page-dot active" data-page="1"></div>
                        <div class="page-dot" data-page="2"></div>
                    </div>
                    
                        <!-- Swipe Hint (Page 1 only) -->
                        <div class="swipe-hint">→ 滑动查看阅读数据</div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Initialize carousel swipe functionality
     */
    function initCarouselSwipe() {
        const carousel = document.querySelector('.report-carousel');
        const container = document.querySelector('.annual-report-container');
        if (!carousel) return;
        
        const track = carousel.querySelector('.report-carousel-track');
        const dots = document.querySelectorAll('.page-dot');
        const hint = document.querySelector('.swipe-hint');
        const pageCount = parseInt(carousel.dataset.pages) || 1;
        
        if (pageCount < 2) return;
        
        let currentPage = 1;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isDragging = false;
        let isHorizontalSwipe = null; // null = not determined, true = horizontal, false = vertical
        
        // Hide hint after 3 seconds
        if (hint) {
            setTimeout(() => {
                hint.classList.add('hidden');
            }, 3000);
        }
        
        function goToPage(page) {
            currentPage = Math.max(1, Math.min(page, pageCount));
            const offset = (currentPage - 1) * -100;
            track.style.webkitTransform = `translateX(${offset}%)`;
            track.style.transform = `translateX(${offset}%)`;
            
            // Update dots
            dots.forEach(dot => {
                dot.classList.toggle('active', parseInt(dot.dataset.page) === currentPage);
            });
            
            // Hide hint when leaving page 1
            if (currentPage > 1 && hint) {
                hint.classList.add('hidden');
            }
        }
        
        // Touch events - detect horizontal vs vertical swipe
        carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            isHorizontalSwipe = null; // Reset - not determined yet
        }, { passive: true });
        
        carousel.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const diffX = touchX - startX;
            const diffY = touchY - startY;
            
            // Determine swipe direction on first significant movement
            if (isHorizontalSwipe === null) {
                const absX = Math.abs(diffX);
                const absY = Math.abs(diffY);
                
                // Need minimum movement to determine direction
                if (absX > 10 || absY > 10) {
                    // If horizontal movement is greater, it's a carousel swipe
                    // Otherwise, it's a vertical scroll - let it pass through
                    isHorizontalSwipe = absX > absY;
                    
                    if (isHorizontalSwipe) {
                        // Start carousel transition
                        track.style.webkitTransition = 'none';
                        track.style.transition = 'none';
                    }
                }
            }
            
            // Only handle carousel swipe if horizontal
            if (isHorizontalSwipe === true) {
                currentX = touchX;
                const offset = (currentPage - 1) * -100 + (diffX / carousel.offsetWidth) * 100;
                track.style.webkitTransform = `translateX(${offset}%)`;
                track.style.transform = `translateX(${offset}%)`;
            }
            // If vertical (isHorizontalSwipe === false), do nothing - let page scroll naturally
        }, { passive: true });
        
        carousel.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            
            // Only process if it was a horizontal swipe
            if (isHorizontalSwipe === true) {
                track.style.webkitTransition = '-webkit-transform 0.3s ease-in-out';
                track.style.transition = 'transform 0.3s ease-in-out';
                
                const diff = currentX - startX;
                const threshold = carousel.offsetWidth * 0.2; // 20% threshold
                
                if (diff < -threshold && currentPage < pageCount) {
                    goToPage(currentPage + 1);
                } else if (diff > threshold && currentPage > 1) {
                    goToPage(currentPage - 1);
                } else {
                    goToPage(currentPage); // Snap back
                }
            }
            
            // Reset
            startX = 0;
            startY = 0;
            currentX = 0;
            isHorizontalSwipe = null;
        });
        
        // Click on dots
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                goToPage(parseInt(dot.dataset.page));
            });
            dot.addEventListener('touchend', (e) => {
                e.preventDefault();
                goToPage(parseInt(dot.dataset.page));
            });
        });
        
        // Keyboard navigation
        if (container) {
            container.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    goToPage(currentPage + 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    goToPage(currentPage - 1);
                }
            });
            // Focus container for keyboard navigation
            container.focus();
        }
    }

    function renderResults() {
        document.getElementById('progress-view').style.display = 'none';
        document.getElementById('results-view').style.display = 'block';
        
        // Show export and refresh buttons when results are ready
        const exportBtn = document.getElementById('export-journey');
        const refreshBtn = document.getElementById('refresh-journey');
        if (exportBtn) {
            exportBtn.classList.add('visible');
        }
        if (refreshBtn) {
            refreshBtn.classList.add('visible');
        }
        
        const sortedYears = Object.keys(yearlyStats).sort((a, b) => b - a);
        
        if (sortedYears.length === 0) {
            document.getElementById('year-tabs').innerHTML = '';
            document.getElementById('year-content').innerHTML = `
                <div class="empty-state" style="text-align:center;padding:40px;color:#666;">
                    <div style="font-size:48px;margin-bottom:20px;">📭</div>
                    <div style="font-size:18px;font-weight:600;margin-bottom:15px;color:#990000;">No Data Found</div>
                    <div style="font-size:14px;line-height:1.6;max-width:400px;margin:0 auto;">
                        <p>We couldn't find any reading history or published works.</p>
                        <p style="margin-top:15px;"><strong>To enable history tracking:</strong></p>
                        <p>Go to <strong>My Dashboard → Preferences → Misc</strong>, then click <strong>"Turn on History"</strong> to enable future tracking.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const has2025 = yearlyStats['2025'] !== undefined;
        
        const bannerEl = document.getElementById('annual-report-banner');
        if (has2025 && bannerEl) {
            bannerEl.innerHTML = `<div class="annual-report-tab active" data-year="annual-2025">✨ 2025 年度报告</div>`;
        } else if (bannerEl) {
            bannerEl.innerHTML = '';
        }
        
        // Render year tabs (all years including 2025)
        const tabsHtml = sortedYears.map((year, i) => 
            `<div class="year-tab ${!has2025 && i === 0 ? 'active' : ''}" data-year="${year}">${year}</div>`
        ).join('');
        document.getElementById('year-tabs').innerHTML = tabsHtml;
        
        const username = getLoggedInUsername() || '';
        
        let contentHtml = '';
        if (has2025) {
            contentHtml += renderConfirmationUI(2025);
            contentHtml += renderAnnualReport(2025, username);
        }
        
        contentHtml += sortedYears.map((year, i) => {
            const stats = yearlyStats[year];
            const c = stats.creator;
            const r = stats.reader;
            const isActive = !has2025 && i === 0;
            
            const topWorksMap = new Map();
            c.topWorks.forEach(w => {
                if (!topWorksMap.has(w.title) || topWorksMap.get(w.title).score < w.score) {
                    topWorksMap.set(w.title, w);
                }
            });
            const topWorks = Array.from(topWorksMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
            
            const topCommenters = Object.entries(c.commenters)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            
            const topKudosGivers = Object.entries(c.kudosGivers || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            
            const topRevisited = Object.entries(r.workVisits)
                .sort((a, b) => b[1].visits - a[1].visits)
                .slice(0, 5);
            
            const hasCreatorData = c.works > 0;
            const hasReaderData = r.fics > 0;
            
            return `
                <div class="year-view ${isActive ? 'active' : ''}" data-year="${year}">
                    ${hasCreatorData ? `
                    <div class="section-card creator">
                        <h3 class="section-title">✍️ ${username ? username + "'s " : ''}Journey as Creator in ${year}</h3>
                        
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">Works Active</div>
                                <div class="stat-value">${c.works}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Words Written</div>
                                <div class="stat-value">${c.words.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Kudos Received</div>
                                <div class="stat-value">${c.kudos.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Comments</div>
                                <div class="stat-value">${c.comments.toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div class="subsection-label">🏆 Popular Works</div>
                        ${topWorks.length > 0 ? topWorks.map(w => `
                            <div class="list-item">
                                <a href="${w.url}" class="work-link list-item-title" target="_blank">${escapeHtml(w.title)}</a>
                                <span class="list-item-value">❤️${w.kudos} 💬${w.comments}</span>
                            </div>
                        `).join('') : '<div class="empty-state">No works yet</div>'}
                        
                        ${topCommenters.length > 0 || topKudosGivers.length > 0 ? `
                        <div class="subsection-label">💕 Loyal Readers</div>
                        ${(() => {
                            const allSupporters = new Map();
                            topCommenters.forEach(([name, count]) => {
                                const kudosCount = (c.kudosGivers && c.kudosGivers[name]) ? c.kudosGivers[name] : 0;
                                allSupporters.set(name, { comments: count, kudos: kudosCount });
                            });
                            topKudosGivers.forEach(([name, count]) => {
                                if (!allSupporters.has(name)) {
                                    const commentCount = (c.commenters && c.commenters[name]) ? c.commenters[name] : 0;
                                    allSupporters.set(name, { comments: commentCount, kudos: count });
                                }
                            });
                            const sorted = Array.from(allSupporters.entries())
                                .sort((a, b) => b[1].comments - a[1].comments || b[1].kudos - a[1].kudos)
                                .slice(0, 3);
                            return sorted.map(([name, stats]) => `
                                <div class="list-item">
                                    <span class="list-item-title">${escapeHtml(name)}</span>
                                    <span class="list-item-value">💬${stats.comments} | ❤️${stats.kudos}</span>
                                </div>
                            `).join('');
                        })()}
                        ` : ''}
                        
                        <div class="subsection-label">🎭 Top Fandoms</div>
                        ${renderTopItems(c.fandoms, 3, v => formatWords(v) + ' words')}
                        
                        <div class="subsection-label">💑 Top Relationships</div>
                        ${renderTopItems(c.relationships, 3, v => formatWords(v) + ' words')}
                        
                        <div class="subsection-label">🏷️ Top Tags</div>
                        ${renderTopItems(c.tags, 5)}
                    </div>
                    ` : ''}
                    
                    ${hasReaderData ? `
                    <div class="section-card reader">
                        <h3 class="section-title">📖 ${username ? username + "'s " : ''}Journey as Reader in ${year}</h3>
                        
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-label">Fics Read</div>
                                <div class="stat-value">${r.fics.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Words Read</div>
                                <div class="stat-value">${r.words.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">"Yes, Continue" Clicks</div>
                                <div class="stat-value">${r.matureClicks.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">Total Visits</div>
                                <div class="stat-value">${Object.values(r.workVisits).reduce((sum, w) => sum + w.visits, 0).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <div class="subsection-label">🎭 Top Fandoms</div>
                        ${renderTopItems(r.fandoms, 3)}
                        
                        <div class="subsection-label">💑 Top Relationships</div>
                        ${renderTopItems(r.relationships, 3)}
                        
                        <div class="subsection-label">👀 Most Revisited Works</div>
                        ${topRevisited.length > 0 ? topRevisited.map(([title, data]) => `
                            <div class="list-item">
                                <a href="${data.url}" class="work-link list-item-title" target="_blank">${escapeHtml(title)}</a>
                                <span class="list-item-value">${data.visits} visits</span>
                            </div>
                        `).join('') : '<div class="empty-state">No works visited</div>'}
                        
                        <div class="subsection-label">🏷️ Top Tropes</div>
                        ${renderTopItems(r.tags, 5)}
                    </div>
                    ` : ''}
                    
                    ${!hasCreatorData && !hasReaderData ? `
                    <div class="section-card">
                        <div class="empty-state" style="text-align:center;padding:20px;">No activity recorded for ${year}</div>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        document.getElementById('year-content').innerHTML = contentHtml;
        
        const allClickableTabs = document.querySelectorAll('.year-tab, .annual-report-tab');
        const journeyWrapper = document.getElementById('journey-wrapper');
        const header = document.getElementById('journey-header');
        
        allClickableTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from ALL tabs
                document.querySelectorAll('.year-tab, .annual-report-tab').forEach(t => t.classList.remove('active'));
                
                // Remove active from ALL views - be very explicit
                document.querySelectorAll('.year-view').forEach(v => v.classList.remove('active'));
                document.querySelectorAll('.annual-report-view').forEach(v => v.classList.remove('active'));
                document.querySelectorAll('.report-confirm-view').forEach(v => v.classList.remove('active'));
                
                tab.classList.add('active');
                
                const targetYear = tab.dataset.year;
                
                if (targetYear.startsWith('annual-')) {
                    // Hide year tabs when viewing annual report
                    journeyWrapper?.classList.add('annual-report-active');
                    
                    // Make sure ALL year views are hidden
                    document.querySelectorAll('.year-view').forEach(v => {
                        v.classList.remove('active');
                        v.style.display = 'none';
                    });
                    
                    // Make sure confirmation view is hidden
                    document.querySelectorAll('.report-confirm-view').forEach(v => {
                        v.classList.remove('active');
                        v.style.display = 'none';
                    });
                    
                    if (hasConfirmedAnnualReport) {
                        const annualView = document.querySelector('.annual-report-view');
                        if (annualView) {
                            annualView.classList.add('active');
                            annualView.style.display = 'block';
                        }
                        // Show header when viewing annual report
                        header?.classList.remove('hidden');
                        // Re-initialize carousel
                        setTimeout(() => initCarouselSwipe(), 100);
                    } else {
                        const confirmView = document.querySelector(`.report-confirm-view[data-year="confirm-2025"]`);
                        if (confirmView) {
                            confirmView.classList.add('active');
                            confirmView.style.display = 'block';
                            header?.classList.add('hidden');
                        }
                    }
                } else {
                    // Show year tabs when viewing regular year view
                    journeyWrapper?.classList.remove('annual-report-active');
                    
                    // Make sure header is visible
                    header?.classList.remove('hidden');
                    
                    // Make sure annual report view is hidden
                    document.querySelectorAll('.annual-report-view').forEach(v => {
                        v.classList.remove('active');
                        v.style.display = 'none';
                    });
                    
                    // Make sure confirm view is hidden
                    document.querySelectorAll('.report-confirm-view').forEach(v => {
                        v.classList.remove('active');
                        v.style.display = 'none';
                    });
                    
                    // Hide ALL year views first (reset inline styles)
                    document.querySelectorAll('.year-view').forEach(v => {
                        v.classList.remove('active');
                        v.style.display = 'none';
                    });
                    
                    // Then show only the target year view
                    const targetView = document.querySelector(`.year-view[data-year="${targetYear}"]`);
                    if (targetView) {
                        targetView.classList.add('active');
                        targetView.style.display = 'block';
                    }
                }
            });
        });
        
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');
        
        if (has2025 && header) {
            header.classList.add('hidden');
            // Also hide year tabs when starting on annual report
            journeyWrapper?.classList.add('annual-report-active');
        }
        
        if (yesBtn) {
            yesBtn.addEventListener('click', () => {
                // Mark as confirmed so it won't show again
                hasConfirmedAnnualReport = true;
                
                // Hide confirmation view completely
                const confirmView = document.querySelector('.report-confirm-view');
                if (confirmView) {
                    confirmView.classList.remove('active');
                    confirmView.style.display = 'none';
                }
                
                // Show annual report view
                const annualReportView = document.querySelector('.annual-report-view');
                if (annualReportView) {
                    annualReportView.classList.add('active');
                    annualReportView.style.display = 'block';
                }
                
                // Show header
                header?.classList.remove('hidden');
                
                // Keep year tabs hidden for annual report
                journeyWrapper?.classList.add('annual-report-active');
                
                // Initialize carousel swipe
                initCarouselSwipe();
            });
        }
        
        if (noBtn) {
            noBtn.addEventListener('click', () => {
                // Close the overlay (same as close button)
                const overlay = document.getElementById('journey-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                }
                
                // Reset UI state completely but preserve yearlyStats data
                const confirmView = document.querySelector('.report-confirm-view');
                if (confirmView) {
                    confirmView.classList.remove('active');
                    confirmView.style.display = 'none';
                }
                
                // Reset header and wrapper visibility
                header?.classList.remove('hidden');
                journeyWrapper?.classList.remove('annual-report-active');
                
                // Data is preserved in yearlyStats and cache - user can reopen anytime
                debugLog('User clicked "No, Go Back" - overlay closed, data preserved');
            });
        }
    }

    // ==================== UI CREATION ====================

    function createUI() {
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
        
        const fab = document.createElement('button');
        fab.id = 'floating-journey-btn';
        fab.textContent = '📖 My AO3 Journey';
        document.body.appendChild(fab);
        
        const overlay = document.createElement('div');
        overlay.id = 'journey-overlay';
        overlay.innerHTML = `
            <div id="journey-wrapper">
                <div id="journey-header">
                    <div id="journey-title-container">
                        <img src="https://archiveofourown.org/images/ao3_logos/logo_42.png" alt="AO3" id="ao3-header-logo">
                        <h2 id="journey-title">AO3 Journey</h2>
                    </div>
                    <div id="journey-header-buttons">
                        <button id="refresh-journey">🔄 Refresh</button>
                        <button id="export-journey">📷 Export</button>
                        <button id="close-journey">✕ Close</button>
                    </div>
                    <div id="annual-report-banner"></div>
                    <div id="year-tabs"></div>
                </div>
                
                <div id="journey-content">
                    <div id="progress-view">
                        <div id="progress-title">正在创建你的AO3年度报告<span class="dots"></span></div>
                        <div id="progress-status">Initializing...</div>
                        <div id="progress-bar-container">
                            <div id="progress-bar"></div>
                        </div>
                        <div id="progress-detail"></div>
                    </div>
                    
                    <div id="results-view">
                        <div id="year-content"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Handle fab click/touch
        let fabClicked = false;
        const handleFabClick = (e) => {
            if (fabClicked) return; // Prevent double-trigger
            fabClicked = true;
            setTimeout(() => { fabClicked = false; }, 500);
            
            e.preventDefault();
            e.stopPropagation();
            
            debugLog('FAB clicked, showing overlay...');
            overlay.style.display = 'flex';
            
            // Step 1: Check if data is available
            const hasData = Object.keys(yearlyStats).length > 0 && yearlyStats['2025'];
            
            if (!isScanning && !hasData) {
                // Step 3: No data - start scanning
                debugLog('Starting new scan...');
                const progressView = document.getElementById('progress-view');
                const resultsView = document.getElementById('results-view');
                
                if (progressView) progressView.style.display = 'flex';
                if (resultsView) resultsView.style.display = 'none';
                
                // Hide refresh and export buttons during loading
                document.getElementById('export-journey')?.classList.remove('visible');
                document.getElementById('refresh-journey')?.classList.remove('visible');
                
                updateProgress('正在启动...', 'Starting...', 0);
                
                // Use setTimeout to ensure UI updates before async work
                setTimeout(() => {
                    startFullScan().catch(err => {
                        debugLog('❌ startFullScan error:', err);
                        updateProgress('扫描出错', err.message);
                    });
                }, 100);
            } else if (hasData) {
                // Step 2: Data available - check confirmation status
                const header = document.getElementById('journey-header');
                const journeyWrapper = document.getElementById('journey-wrapper');
                
                // Hide all views first (clean slate)
                document.querySelectorAll('.year-view').forEach(v => {
                    v.classList.remove('active');
                    v.style.display = 'none';
                });
                document.querySelectorAll('.annual-report-view').forEach(v => {
                    v.classList.remove('active');
                    v.style.display = 'none';
                });
                const confirmView = document.querySelector('.report-confirm-view');
                if (confirmView) {
                    confirmView.classList.remove('active');
                    confirmView.style.display = 'none';
                }
                
                if (hasConfirmedAnnualReport) {
                    // Step 2a: Already confirmed - show annual report directly
                    debugLog('User already confirmed, showing annual report...');
                    header?.classList.remove('hidden');
                    journeyWrapper?.classList.add('annual-report-active');
                    const annualReportView = document.querySelector('.annual-report-view');
                    if (annualReportView) {
                        annualReportView.classList.add('active');
                        annualReportView.style.display = 'block';
                    }
                    document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('.annual-report-tab')?.classList.add('active');
                    initCarouselSwipe();
                } else {
                    // Step 2b: Not confirmed - show confirmation page
                    debugLog('Showing confirmation page (user has not confirmed yet)...');
                    header?.classList.add('hidden');
                    journeyWrapper?.classList.add('annual-report-active');
                    if (confirmView) {
                        confirmView.classList.add('active');
                        confirmView.style.display = 'block';
                    }
                    document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('.annual-report-tab')?.classList.add('active');
                }
            }
        };
        fab.addEventListener('click', handleFabClick);
        fab.addEventListener('touchend', handleFabClick);
        
        // Handle close button click/touch
        const closeBtn = document.getElementById('close-journey');
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            debugLog('Close button clicked');
            overlay.style.display = 'none';
        };
        closeBtn.addEventListener('click', handleClose);
        closeBtn.addEventListener('touchend', handleClose);
        
        // Handle refresh button click
        const refreshBtn = document.getElementById('refresh-journey');
        const handleRefresh = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isScanning) return;
            
            const confirmRefresh = confirm(
                '🔄 重新扫描所有数据？\nRescan all data?\n\n' +
                '这将清除缓存并重新扫描所有历史记录。\n' +
                'This will clear the cache and rescan all history.'
            );
            
            if (confirmRefresh) {
                debugLog('🔄 User requested full refresh');
                clearCache();
                
                // Reset UI to progress view
                const progressView = document.getElementById('progress-view');
                const resultsView = document.getElementById('results-view');
                
                if (progressView) progressView.style.display = 'flex';
                if (resultsView) resultsView.style.display = 'none';
                
                // Hide the refresh button during scan
                refreshBtn.classList.remove('visible');
                
                // Start fresh scan
                await startScan(true);
            }
        };
        refreshBtn.addEventListener('click', handleRefresh);
        refreshBtn.addEventListener('touchend', handleRefresh);
        
        // Handle export button click
        const exportBtn = document.getElementById('export-journey');
        let exportInProgress = false;
        
        const handleExport = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (exportInProgress) return;
            exportInProgress = true;
            
            exportBtn.disabled = true;
            exportBtn.textContent = '⏳ 导出中...';
            
            try {
                // Load html2canvas if not already loaded
                if (!window.html2canvas) {
                    debugLog('Loading html2canvas...');
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
                
                // Check if on confirmation page
                const confirmView = document.querySelector('.report-confirm-view.active');
                if (confirmView) {
                    alert('请先点击 "Yes, Continue" 进入报告页面后再导出\nPlease click "Yes, Continue" first');
                    return;
                }
                
                // Scroll overlay to top first
                const overlay = document.getElementById('journey-overlay');
                if (overlay) overlay.scrollTop = 0;
                
                // Enable export mode on the wrapper
                const wrapper = document.getElementById('journey-wrapper');
                wrapper?.classList.add('export-mode');
                
                // Wait for CSS to apply and layout to stabilize
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Ensure fonts are loaded before capturing
                if (document.fonts && document.fonts.ready) {
                    await document.fonts.ready;
                }
                
                // Find the active content to capture
                let targetEl = null;
                let captureType = 'unknown';
                
                // Method 1: Check for annual report - capture the container directly
                const annualReportView = document.querySelector('.annual-report-view.active');
                if (annualReportView) {
                    // For annual reports, capture the container for clean export
                    const container = document.querySelector('.annual-report-container');
                    if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
                        targetEl = container;
                        captureType = 'annual-report';
                        debugLog('Found annual report container:', container.offsetWidth, 'x', container.offsetHeight);
                    } else if (annualReportView.offsetWidth > 0 && annualReportView.offsetHeight > 0) {
                        // Fallback to view if container not found
                        targetEl = annualReportView;
                        captureType = 'annual-report';
                        debugLog('Found annual report view (fallback):', annualReportView.offsetWidth, 'x', annualReportView.offsetHeight);
                    }
                }
                
                // Method 2: Check for active year view - capture just the active year view
                if (!targetEl) {
                    const yearView = document.querySelector('.year-view.active');
                    if (yearView && yearView.offsetWidth > 0 && yearView.offsetHeight > 0) {
                        targetEl = yearView;
                        captureType = 'year-view';
                        debugLog('Found year view:', targetEl.offsetWidth, 'x', targetEl.offsetHeight);
                    }
                }
                
                // Method 3: Try results view
                if (!targetEl) {
                    const resultsView = document.getElementById('results-view');
                    if (resultsView && resultsView.offsetWidth > 0 && resultsView.offsetHeight > 0) {
                        targetEl = resultsView;
                        captureType = 'results-view';
                        debugLog('Found results view:', resultsView.offsetWidth, 'x', resultsView.offsetHeight);
                    }
                }
                
                // Method 4: Fallback to wrapper
                if (!targetEl) {
                    const wrapper = document.getElementById('journey-wrapper');
                    if (wrapper && wrapper.offsetWidth > 0 && wrapper.offsetHeight > 0) {
                        targetEl = wrapper;
                        captureType = 'wrapper';
                        debugLog('Found wrapper:', wrapper.offsetWidth, 'x', wrapper.offsetHeight);
                    }
                }
                
                if (!targetEl) {
                    alert('没有可导出的内容\nNo content to export');
                    return;
                }
                
                // Force element to be visible and get accurate dimensions
                targetEl.style.display = 'block';
                targetEl.style.visibility = 'visible';
                
                // Wait a bit more after ensuring visibility
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Get dimensions - use FIXED dimensions from config for consistency
                let width, height;
                const isAnnualReport = captureType === 'annual-report';
                
                // Determine current active page for annual report
                const activeDot = document.querySelector('.page-dot.active');
                const currentPageNum = activeDot ? activeDot.dataset.page : '1';
                
                if (isAnnualReport) {
                    // Use FIXED dimensions from config: 1242px × 1660px (at 2x scale)
                    width = EXPORT_CONFIG.annualReport.width;   // 621px → 1242px output
                    height = EXPORT_CONFIG.annualReport.height; // 830px → 1660px output
                    debugLog('Annual report FIXED dimensions:', width, 'x', height, '(output:', width*2, 'x', height*2, ')');
                } else {
                    // Year view - fixed width 1080px (540 × 2), dynamic height based on content
                    width = EXPORT_CONFIG.yearView.width;  // 540px → 1080px output
                    
                    // Temporarily set overflow to visible to get true content height
                    const originalOverflow = targetEl.style.overflow;
                    const originalHeight = targetEl.style.height;
                    const originalMaxHeight = targetEl.style.maxHeight;
                    targetEl.style.overflow = 'visible';
                    targetEl.style.height = 'auto';
                    targetEl.style.maxHeight = 'none';
                    
                    // Force layout recalculation
                    await new Promise(r => setTimeout(r, 100));
                    
                    // Calculate height from actual content - sum all child heights
                    let totalChildHeight = 30; // Start with padding
                    targetEl.querySelectorAll('.section-card').forEach(card => {
                        // Get full height including margins
                        const cardStyle = window.getComputedStyle(card);
                        const marginTop = parseInt(cardStyle.marginTop) || 0;
                        const marginBottom = parseInt(cardStyle.marginBottom) || 0;
                        totalChildHeight += card.scrollHeight + marginTop + marginBottom;
                    });
                    
                    // Also check all subsections and list items
                    targetEl.querySelectorAll('.subsection-label, .list-item').forEach(el => {
                        // These are already counted in section-card, but let's verify
                    });
                    
                    const rect = targetEl.getBoundingClientRect();
                    const contentHeight = Math.max(
                        rect.height,
                        targetEl.offsetHeight,
                        targetEl.scrollHeight,
                        totalChildHeight
                    );
                    
                    // Restore original styles
                    targetEl.style.overflow = originalOverflow;
                    targetEl.style.height = originalHeight;
                    targetEl.style.maxHeight = originalMaxHeight;
                    
                    // Add extra padding to ensure all content (including Top Tropes) is captured
                    height = Math.max(contentHeight + 200, 1000); // Add 200px padding, min 1000px
                    debugLog('Year view dimensions:', width, 'x', height, 'totalChildHeight:', totalChildHeight, '(output:', width*3, 'x', height*3, ')');
                }
                
                debugLog('Export target:', captureType, '- Dimensions:', width, 'x', height);
                
                if (width < 50 || height < 50) {
                    alert('内容区域太小，无法导出\nContent area too small');
                    return;
                }
                
                // Capture with proper background (pink for annual report, white for others)
                const bgColor = captureType === 'annual-report' ? '#fff5f5' : '#ffffff';
                const exportScale = isAnnualReport ? EXPORT_CONFIG.scale : (EXPORT_CONFIG.yearView.scale || 3);
                const canvas = await window.html2canvas(targetEl, {
                    backgroundColor: bgColor,
                    scale: exportScale, // Higher scale for sharper year view export
                    width: width,
                    height: height,
                    useCORS: true,
                    allowTaint: true,
                    logging: CONFIG.DEBUG_MODE,
                    imageTimeout: 15000,
                    ignoreElements: (element) => {
                        // Ignore elements that might cause pattern errors
                        const tagName = element.tagName?.toLowerCase();
                        if (tagName === 'style' || tagName === 'script') return false;
                        
                        // Check for problematic computed styles
                        try {
                            const style = window.getComputedStyle(element, '::before');
                            const bgImage = style.backgroundImage;
                            if (bgImage && bgImage.includes('radial-gradient')) {
                                return true; // Ignore this element
                            }
                        } catch (e) {}
                        
                        return false;
                    },
                    onclone: (clonedDoc) => {
                        // Add export-mode class to cloned wrapper
                        const clonedWrapper = clonedDoc.getElementById('journey-wrapper');
                        if (clonedWrapper) {
                            clonedWrapper.classList.add('export-mode');
                        }
                        
                        // Apply fixed export styles based on content type
                        if (isAnnualReport) {
                            // Use the helper function for annual report
                            applyAnnualReportExportStyles(clonedDoc, currentPageNum);
                            
                            // Additional annual report specific fixes
                            const clonedAnnualView = clonedDoc.querySelector('.annual-report-view.active');
                            if (clonedAnnualView) {
                                clonedAnnualView.style.cssText = `
                                    display: flex !important;
                                    flex-direction: column !important;
                                    background: ${EXPORT_CONFIG.annualReport.colors.background} !important;
                                    width: ${width}px !important;
                                    height: auto !important;
                                    overflow: visible !important;
                                    padding: 20px !important;
                                `;
                            }
                        } else {
                            // Use the helper function for year view
                            applyYearViewExportStyles(clonedDoc, width, height);
                        }
                        
                        // Common fixes for both export types
                        
                        // Ensure body and html have solid backgrounds
                        if (clonedDoc.body) {
                            clonedDoc.body.style.cssText = `
                                background: ${bgColor} !important;
                                background-image: none !important;
                                margin: 0 !important;
                                padding: 0 !important;
                            `;
                        }
                        if (clonedDoc.documentElement) {
                            clonedDoc.documentElement.style.cssText = `
                                background: ${bgColor} !important;
                                background-image: none !important;
                            `;
                        }
                        
                        // Inject CSS to remove pseudo-elements and gradients
                        const styleOverride = clonedDoc.createElement('style');
                        styleOverride.textContent = `
                            *::before, *::after {
                                display: none !important;
                                content: '' !important;
                                background: transparent !important;
                            }
                            * {
                                -webkit-backdrop-filter: none !important;
                                backdrop-filter: none !important;
                            }
                            html, body {
                                background: ${bgColor} !important;
                                background-image: none !important;
                            }
                            .page-indicators, .swipe-hint {
                                display: none !important;
                            }
                            .report-page { display: none !important; }
                            .report-page.export-active { display: flex !important; flex-direction: column !important; }
                            /* Hide footers inside report-pages - only show cloned footer at container level */
                            .report-page .report-footer { display: none !important; }
                            .annual-report-container > .report-footer { display: block !important; }
                            /* Year view - ensure solid white background, no transparency */
                            .year-view.active {
                                background: #ffffff !important;
                                background-color: #ffffff !important;
                                background-image: none !important;
                                opacity: 1 !important;
                            }
                            .year-view.active .section-card,
                            .year-view.active .stat-box,
                            .year-view.active .list-item {
                                opacity: 1 !important;
                            }
                        `;
                        clonedDoc.head.appendChild(styleOverride);
                        
                        // Hide buttons and header in export
                        ['export-journey', 'close-journey', 'journey-header-buttons'].forEach(id => {
                            const el = clonedDoc.getElementById(id);
                            if (el) el.style.display = 'none';
                        });
                        
                        const headerTitle = clonedDoc.querySelector('#journey-header h2');
                        if (headerTitle) headerTitle.style.display = 'none';
                        
                        // Hide inactive views
                        clonedDoc.querySelectorAll('.year-view:not(.active), .annual-report-view:not(.active), .report-confirm-view').forEach(el => {
                            el.style.display = 'none';
                            el.style.height = '0';
                        });
                    }
                });
                
                debugLog('Canvas created:', canvas.width, 'x', canvas.height);
                
                if (canvas.width === 0 || canvas.height === 0) {
                    alert('导出失败：画布为空\nExport failed: Canvas is empty');
                    return;
                }
                
                // Add watermark to canvas
                const ctx = canvas.getContext('2d');
                const exportUsername = getLoggedInUsername() || 'user';
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const watermark = `${exportUsername}@${dateStr}`;
                
                ctx.save();
                ctx.font = '24px Arial, sans-serif';
                ctx.fillStyle = 'rgba(153, 0, 0, 0.5)';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(watermark, canvas.width - 20, canvas.height - 15);
                ctx.restore();
                
                const year = document.querySelector('.year-tab.active')?.dataset?.year || 
                             document.querySelector('.annual-report-tab.active')?.dataset?.year?.replace('annual-', '') || 
                             '2025';
                
                // Check if iOS
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                
                if (isIOS) {
                    // On iOS, try Web Share API first, then fallback to new tab
                    const dataUrl = canvas.toDataURL('image/png');
                    
                    // Convert to blob for sharing
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `AO3-Journey-${year}.png`, { type: 'image/png' });
                    
                    // Try native share if available
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                files: [file],
                                title: `AO3 Journey ${year}`,
                                text: '我的AO3年度报告'
                            });
                            debugLog('Shared successfully');
                            return;
                        } catch (shareErr) {
                            debugLog('Share failed, opening in new tab:', shareErr);
                        }
                    }
                    
                    // Fallback: open in new tab with better styling
                    const newWindow = window.open();
                    if (newWindow) {
                        newWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta name="viewport" content="width=device-width, initial-scale=1">
                                <title>AO3 Journey - ${year}</title>
                                <style>
                                    body { 
                                        margin: 0; 
                                        padding: 20px;
                                        background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
                                        min-height: 100vh;
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                    }
                                    .tip {
                                        background: #990000;
                                        color: white;
                                        padding: 12px 20px;
                                        border-radius: 25px;
                                        margin-bottom: 20px;
                                        font-family: -apple-system, sans-serif;
                                        font-size: 14px;
                                        text-align: center;
                                    }
                                    img {
                                        max-width: 100%;
                                        height: auto;
                                        border-radius: 12px;
                                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="tip">📷 长按图片 → 保存到相册</div>
                                <img src="${dataUrl}">
                            </body>
                            </html>
                        `);
                        newWindow.document.close();
                    }
                } else {
                    // Desktop - use blob download
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            alert('导出失败\nExport failed');
                            return;
                        }
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `AO3-Journey-${year}.png`;
                        link.href = url;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }, 'image/png');
                }
                
                debugLog('Export complete!');
            } catch (err) {
                console.error('Export failed:', err);
                debugLog('Export error:', err.message, err.stack);
                alert('导出失败: ' + err.message);
            } finally {
                // Remove export mode
                const wrapper = document.getElementById('journey-wrapper');
                wrapper?.classList.remove('export-mode');
                
                exportBtn.disabled = false;
                exportBtn.textContent = '📷 Export';
                exportInProgress = false;
            }
        };
        exportBtn.addEventListener('click', handleExport);
        exportBtn.addEventListener('touchend', handleExport);
    }

    // ==================== INITIALIZATION ====================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }
})();

