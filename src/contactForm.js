// Contact Form - EmailJS Integration
// Handles form submission to send emails via EmailJS service

// Initialize EmailJS with public key
emailjs.init('70rEsPXlc8tY_Abu-');

const form = document.querySelector('.contact-form');
const submitButton = form?.querySelector('.contact-form-submit');
const buttonLabel = submitButton?.querySelector('.button__label');

// Store original button text
const originalButtonText = buttonLabel?.textContent || 'SEND';

// Handle form submission
if (form && submitButton) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Check if already sending
        if (submitButton.disabled) return;
        
        // Get form data
        const formData = new FormData(form);
        const data = {
            from_name: formData.get('name'),
            from_email: formData.get('email'),
            message: formData.get('message')
        };
        
        // Validate data
        if (!data.from_name || !data.from_email || !data.message) {
            showMessage('Please fill in all fields', 'error');
            return;
        }
        
        try {
            // Update button state to loading
            submitButton.disabled = true;
            submitButton.classList.add('is-loading');
            if (buttonLabel) buttonLabel.textContent = 'SENDING...';
            
            // Send email via EmailJS
            const response = await emailjs.send(
                'service_m1gwikt',  // Service ID
                'template_7fuo8f1', // Template ID
                data
            );
            
            console.log('Email sent successfully:', response);
            
            // Show success message
            showMessage('Message sent successfully! I\'ll get back to you soon.', 'success');
            
            // Reset form after short delay
            setTimeout(() => {
                form.reset();
            }, 500);
            
        } catch (error) {
            console.error('Failed to send email:', error);
            showMessage('Failed to send message. Please try again or email me directly.', 'error');
        } finally {
            // Reset button state
            submitButton.disabled = false;
            submitButton.classList.remove('is-loading');
            if (buttonLabel) buttonLabel.textContent = originalButtonText;
        }
    });
}

// Show temporary message to user
function showMessage(text, type = 'success') {
    // Remove any existing messages
    const existingMessage = document.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const message = document.createElement('div');
    message.className = `form-message form-message--${type}`;
    message.textContent = text;
    
    // Insert after form
    form.parentNode.insertBefore(message, form.nextSibling);
    
    // Fade in
    requestAnimationFrame(() => {
        message.classList.add('is-visible');
    });
    
    // Remove after 5 seconds
    setTimeout(() => {
        message.classList.remove('is-visible');
        setTimeout(() => message.remove(), 300);
    }, 5000);
}
