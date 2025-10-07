// Copy email functionality for contact section

let copyTimeout = null;

function initContactCopy() {
    const copyBtn = document.querySelector('.contact-copy-btn');
    
    if (!copyBtn) return;
    
    copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = copyBtn.dataset.email;
        const copyIcon = copyBtn.querySelector('.contact-copy-icon');
        const checkIcon = copyBtn.querySelector('.contact-check-icon');
        
        // Clear any existing timeout
        if (copyTimeout) {
            clearTimeout(copyTimeout);
            copyTimeout = null;
        }
        
        try {
            // Try using the modern Clipboard API
            await navigator.clipboard.writeText(email);
            
            // Show checkmark
            if (copyIcon && checkIcon) {
                copyIcon.style.display = 'none';
                checkIcon.style.display = 'block';
                
                // Revert to copy icon after 3 seconds
                copyTimeout = setTimeout(() => {
                    copyIcon.style.display = 'block';
                    checkIcon.style.display = 'none';
                    copyTimeout = null;
                }, 3000);
            }
            
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = email;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                
                // Show checkmark on successful fallback copy
                if (copyIcon && checkIcon) {
                    copyIcon.style.display = 'none';
                    checkIcon.style.display = 'block';
                    
                    copyTimeout = setTimeout(() => {
                        copyIcon.style.display = 'block';
                        checkIcon.style.display = 'none';
                        copyTimeout = null;
                    }, 3000);
                }
            } catch (fallbackErr) {
                console.error('Failed to copy email:', fallbackErr);
            }
            
            document.body.removeChild(textArea);
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactCopy);
} else {
    initContactCopy();
}
