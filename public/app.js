// Keno Game Frontend Application
class KenoGame {
    constructor() {
        this.apiBase = '/api/v1';
        this.token = localStorage.getItem('keno_token');
        this.user = null;
        this.selectedNumbers = [];
        this.currentWager = 25.00;
        this.currentSpotSize = 1;
        this.currentAuthMode = 'login';
        this.pendingRegistration = null;
        this.purchasedTickets = JSON.parse(localStorage.getItem('keno_tickets') || '[]');
        this.userBalance = parseFloat(localStorage.getItem('keno_balance') || '50000.00');
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.generateNumberGrid();
        
        if (this.token) {
            await this.verifyToken();
        } else {
            this.showWelcomeScreen();
        }
    }

    setupEventListeners() {
        // Auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showAuthModal('register'));
        document.getElementById('closeModal').addEventListener('click', () => this.hideAuthModal());
        document.getElementById('authSwitchBtn').addEventListener('click', () => this.toggleAuthMode());
        
        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('otpForm').addEventListener('submit', (e) => this.handleOTP(e));
        
        // OTP actions
        document.getElementById('resendOtpBtn').addEventListener('click', () => this.resendOTP());
        document.getElementById('changeMobileBtn').addEventListener('click', () => this.changeMobile());
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Game buttons
        document.getElementById('startPlayingBtn').addEventListener('click', () => this.startGame());
        document.getElementById('quickPickBtn').addEventListener('click', () => this.quickPick());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearSelection());
        document.getElementById('purchaseBtn').addEventListener('click', () => this.purchaseTicket());

        // Configuration changes
        document.getElementById('spotSize').addEventListener('change', (e) => this.updateSpotSize(e.target.value));
        document.querySelectorAll('.wager-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectWager(e.target.dataset.amount));
        });
        document.getElementById('customWager').addEventListener('input', (e) => this.setCustomWager(e.target.value));

        // Modal click outside to close
        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target.id === 'authModal') {
                this.hideAuthModal();
            }
        });

        // OTP input formatting
        document.getElementById('otpCode').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    generateNumberGrid() {
        const grid = document.getElementById('numberGrid');
        grid.innerHTML = '';

        for (let i = 1; i <= 80; i++) {
            const btn = document.createElement('button');
            btn.className = 'number-btn';
            btn.textContent = i;
            btn.dataset.number = i;
            btn.addEventListener('click', (e) => this.toggleNumber(parseInt(e.target.dataset.number)));
            grid.appendChild(btn);
        }
    }

    toggleNumber(number) {
        const btn = document.querySelector(`[data-number="${number}"]`);
        
        if (this.selectedNumbers.includes(number)) {
            // Remove number with animation
            this.selectedNumbers = this.selectedNumbers.filter(n => n !== number);
            btn.classList.remove('selected');
            
            // Add animation class
            btn.style.animation = 'pulseOut 0.3s ease-out';
            
            setTimeout(() => {
                btn.style.animation = '';
            }, 300);
        } else {
            if (this.selectedNumbers.length >= this.currentSpotSize) {
                this.showNotification('Maximum number of spots reached', 'warning');
                return;
            }
            
            // Add number with animation
            this.selectedNumbers.push(number);
            btn.classList.add('selected');
            
            // Add animation class
            btn.style.animation = 'pulseIn 0.3s ease-out';
            
            setTimeout(() => {
                btn.style.animation = '';
            }, 300);
        }
        
        this.updateSelectedNumbers();
        this.updateTicketSummary();
    }

    updateSelectedNumbers() {
        const container = document.getElementById('selectedNumbers');
        
        if (this.selectedNumbers.length === 0) {
            container.innerHTML = '<p class="empty-message">No numbers selected</p>';
            return;
        }

        container.innerHTML = this.selectedNumbers
            .sort((a, b) => a - b)
            .map(num => `<span class="selected-number">${num}</span>`)
            .join('');
    }

    updateSpotSize(spotSize) {
        this.currentSpotSize = parseInt(spotSize);
        
        // Clear selection if it exceeds new spot size
        if (this.selectedNumbers.length > this.currentSpotSize) {
            this.clearSelection();
        }
        
        this.updateTicketSummary();
    }

    selectWager(amount) {
        this.currentWager = parseFloat(amount);
        
        // Update button states
        document.querySelectorAll('.wager-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-amount="${amount}"]`).classList.add('active');
        
        // Clear custom wager
        document.getElementById('customWager').value = '';
        
        this.updateTicketSummary();
    }

    setCustomWager(value) {
        const amount = parseFloat(value);
        if (amount >= 5 && amount <= 1000) {
            this.currentWager = amount;
            
            // Clear wager button selection
            document.querySelectorAll('.wager-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            this.updateTicketSummary();
        }
    }

    updateTicketSummary() {
        document.getElementById('summarySpots').textContent = this.selectedNumbers.length;
        document.getElementById('summaryWager').textContent = `${this.currentWager.toFixed(2)} ETB`;
        document.getElementById('summaryTotal').textContent = `${this.currentWager.toFixed(2)} ETB`;
        
        // Enable/disable purchase button
        const purchaseBtn = document.getElementById('purchaseBtn');
        const isValid = this.selectedNumbers.length === this.currentSpotSize && 
                       this.selectedNumbers.length > 0 && 
                       this.currentWager > 0 &&
                       this.userBalance >= this.currentWager;
        
        purchaseBtn.disabled = !isValid;
    }

    quickPick() {
        this.clearSelection();
        
        const availableNumbers = Array.from({ length: 80 }, (_, i) => i + 1);
        const shuffled = availableNumbers.sort(() => Math.random() - 0.5);
        
        this.selectedNumbers = shuffled.slice(0, this.currentSpotSize).sort((a, b) => a - b);
        
        // Update UI with animation
        this.selectedNumbers.forEach((num, index) => {
            setTimeout(() => {
                const btn = document.querySelector(`[data-number="${num}"]`);
                btn.classList.add('selected');
                btn.style.animation = 'quickPickSelect 0.5s ease-out';
                
                setTimeout(() => {
                    btn.style.animation = '';
                }, 500);
            }, index * 100); // Stagger the animation
        });
        
        this.updateSelectedNumbers();
        this.updateTicketSummary();
    }

    clearSelection() {
        this.selectedNumbers = [];
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('selected', 'matched');
        });
        this.updateSelectedNumbers();
        this.updateTicketSummary();
    }

    async purchaseTicket() {
        if (!this.user) {
            this.showNotification('Please log in to purchase tickets', 'error');
            return;
        }

        if (this.selectedNumbers.length === 0) {
            this.showNotification('Please select some numbers first', 'error');
            return;
        }

        if (this.userBalance < this.currentWager) {
            this.showNotification('Insufficient balance', 'error');
            return;
        }

        try {
            // Deduct from balance
            this.userBalance -= this.currentWager;
            localStorage.setItem('keno_balance', this.userBalance.toString());
            this.updateBalanceDisplay();

            // Create ticket
            const ticketNumber = 'K' + Date.now().toString().slice(-8);
            const ticket = {
                id: 'ticket_' + Date.now(),
                ticketNumber: ticketNumber,
                spots: [...this.selectedNumbers],
                wager: this.currentWager,
                spotSize: this.currentSpotSize,
                status: 'active',
                purchaseTime: new Date().toISOString(),
                matches: null,
                payout: 0
            };

            // Add to purchased tickets
            this.purchasedTickets.unshift(ticket);
            localStorage.setItem('keno_tickets', JSON.stringify(this.purchasedTickets));

            // Show success animation
            this.showTicketPurchaseAnimation(ticketNumber);
            
            this.showNotification(`Ticket ${ticketNumber} purchased successfully!`, 'success');
            this.clearSelection();
            this.loadUserTickets();
            this.loadLatestDraw();
        } catch (error) {
            console.error('Purchase error:', error);
            this.showNotification('Failed to purchase ticket. Please try again.', 'error');
        }
    }

    updateBalanceDisplay() {
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            balanceElement.textContent = `${this.userBalance.toFixed(2)} ETB`;
        }
    }

    showTicketPurchaseAnimation(ticketNumber) {
        // Create animated ticket element
        const ticketElement = document.createElement('div');
        ticketElement.className = 'ticket-animation';
        ticketElement.innerHTML = `
            <div class="ticket-animation-content">
                <i class="fas fa-ticket-alt"></i>
                <h3>Ticket Purchased!</h3>
                <p>${ticketNumber}</p>
            </div>
        `;
        
        ticketElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            text-align: center;
            z-index: 3000;
            animation: ticketPurchaseAnim 2s ease-out forwards;
        `;

        document.body.appendChild(ticketElement);

        // Remove after animation
        setTimeout(() => {
            if (ticketElement.parentNode) {
                ticketElement.parentNode.removeChild(ticketElement);
            }
        }, 2000);
    }

    loadUserTickets() {
        const container = document.getElementById('ticketsList');
        
        if (this.purchasedTickets.length === 0) {
            container.innerHTML = '<div class="loading">No tickets found</div>';
            return;
        }

        container.innerHTML = this.purchasedTickets.map(ticket => `
            <div class="ticket-item">
                <div class="ticket-header">
                    <span class="ticket-number">${ticket.ticketNumber}</span>
                    <span class="ticket-status ${ticket.status}">${ticket.status}</span>
                </div>
                <div class="ticket-details">
                    <div>Spots: ${ticket.spotSize}</div>
                    <div>Wager: ${ticket.wager.toFixed(2)} ETB</div>
                    <div>Time: ${new Date(ticket.purchaseTime).toLocaleTimeString()}</div>
                    ${ticket.matches !== null ? `<div>Matches: ${ticket.matches}</div>` : ''}
                    ${ticket.payout > 0 ? `<div>Payout: ${ticket.payout.toFixed(2)} ETB</div>` : ''}
                </div>
                <div class="ticket-spots">
                    ${ticket.spots.map(spot => 
                        `<span class="ticket-spot ${ticket.drawNumbers && ticket.drawNumbers.includes(spot) ? 'matched' : ''}">${spot}</span>`
                    ).join('')}
                </div>
            </div>
        `).join('');
    }

    async loadLatestDraw() {
        try {
            const response = await fetch(`${this.apiBase}/draws`);
            const data = await response.json();

            if (data.success && data.data.length > 0) {
                const draw = data.data[0];
                this.displayDraw(draw);
                
                // Check tickets against this draw
                this.checkTicketsAgainstDraw(draw);
            }
        } catch (error) {
            console.error('Error loading draw:', error);
        }
    }

    checkTicketsAgainstDraw(draw) {
        this.purchasedTickets.forEach(ticket => {
            if (ticket.status === 'active') {
                const matches = this.calculateMatches(ticket.spots, draw.numbers);
                ticket.matches = matches;
                ticket.drawNumbers = draw.numbers;
                
                // Calculate payout (simplified)
                if (matches >= 2) {
                    ticket.payout = ticket.wager * (matches * 2);
                    ticket.status = 'settled';
                    
                    // Add winnings to balance
                    this.userBalance += ticket.payout;
                    localStorage.setItem('keno_balance', this.userBalance.toString());
                    this.updateBalanceDisplay();
                }
            }
        });
        
        // Update storage
        localStorage.setItem('keno_tickets', JSON.stringify(this.purchasedTickets));
        
        // Refresh display
        this.loadUserTickets();
    }

    calculateMatches(ticketSpots, drawNumbers) {
        const spotSet = new Set(ticketSpots);
        const drawSet = new Set(drawNumbers);
        
        let matches = 0;
        for (const spot of spotSet) {
            if (drawSet.has(spot)) {
                matches++;
            }
        }
        
        return matches;
    }

    displayDraw(draw) {
        document.getElementById('drawNumber').textContent = draw.drawNumber;
        document.getElementById('drawTime').textContent = new Date(draw.drawTime).toLocaleString();
        
        const container = document.getElementById('drawNumbers');
        container.innerHTML = draw.numbers.map((num, index) => 
            `<div class="draw-number" style="animation-delay: ${index * 0.1}s">${num}</div>`
        ).join('');
    }

    showAuthModal(mode) {
        this.currentAuthMode = mode;
        const modal = document.getElementById('authModal');
        const title = document.getElementById('modalTitle');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const otpForm = document.getElementById('otpForm');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');

        // Hide all forms first
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        otpForm.style.display = 'none';

        if (mode === 'login') {
            title.textContent = 'Login';
            loginForm.style.display = 'block';
            switchText.textContent = "Don't have an account?";
            switchBtn.textContent = 'Register';
        } else {
            title.textContent = 'Register';
            registerForm.style.display = 'block';
            switchText.textContent = 'Already have an account?';
            switchBtn.textContent = 'Login';
        }

        modal.classList.add('show');
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.getElementById('otpForm').reset();
        this.pendingRegistration = null;
    }

    toggleAuthMode() {
        const mode = this.currentAuthMode === 'login' ? 'register' : 'login';
        this.showAuthModal(mode);
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');

        try {
            // Demo login credentials
            if ((username === 'admin' && password === 'admin123') || 
                (username === 'player' && password === 'player123') ||
                (username === '+251912345678' && password === 'mobile123')) {
                
                this.token = 'demo_token_' + Date.now();
                this.user = { 
                    id: '1', 
                    username: username, 
                    role: username === 'admin' ? 'admin' : 'player',
                    mobile: username.startsWith('+') ? username : null
                };
                localStorage.setItem('keno_token', this.token);
                this.hideAuthModal();
                this.startGame();
                this.showNotification('Login successful!', 'success');
            } else {
                this.showNotification('Invalid credentials. Try admin/admin123, player/player123, or +251912345678/mobile123', 'error');
            }
        } catch (error) {
            this.showNotification('Login failed', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const email = formData.get('email');
        const mobile = formData.get('mobile');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const countryCode = document.getElementById('countryCode').value;

        // Validation
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        if (mobile.length < 9 || mobile.length > 10) {
            this.showNotification('Please enter a valid Ethiopian mobile number (9-10 digits)', 'error');
            return;
        }
        
        // Ethiopian mobile number validation (should start with 9)
        if (!mobile.startsWith('9')) {
            this.showNotification('Ethiopian mobile numbers must start with 9', 'error');
            return;
        }

        try {
            // Store registration data
            this.pendingRegistration = {
                username,
                email,
                mobile: countryCode + mobile,
                password
            };

            // Simulate sending OTP to WhatsApp
            await this.sendOTPToWhatsApp(countryCode + mobile);
            
            // Show OTP form
            this.showOTPForm();
            
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
        }
    }

    async sendOTPToWhatsApp(mobileNumber) {
        // Simulate OTP generation and WhatsApp sending
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP for verification (in real app, this would be server-side)
        this.pendingOTP = otp;
        this.otpExpiry = Date.now() + 300000; // 5 minutes

        // Simulate API call to WhatsApp service
        console.log(`Sending OTP ${otp} to WhatsApp: ${mobileNumber}`);
        
        // Show success message
        this.showNotification(`OTP sent to WhatsApp: ${mobileNumber}`, 'success');
        
        // In a real application, you would integrate with WhatsApp Business API
        // For demo purposes, we'll show the OTP in console
        console.log(`Demo OTP: ${otp}`);
        
        return true;
    }

    showOTPForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const otpForm = document.getElementById('otpForm');
        const title = document.getElementById('modalTitle');
        const switchText = document.getElementById('authSwitchText');
        const switchBtn = document.getElementById('authSwitchBtn');

        // Hide other forms
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        
        // Show OTP form
        otpForm.style.display = 'block';
        title.textContent = 'Verify Mobile';
        
        // Update mobile display
        document.getElementById('otpMobileDisplay').textContent = this.pendingRegistration.mobile;
        
        // Hide auth switch
        switchText.style.display = 'none';
        switchBtn.style.display = 'none';
    }

    async handleOTP(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const enteredOTP = formData.get('otp');

        try {
            // Check if OTP is valid and not expired
            if (Date.now() > this.otpExpiry) {
                this.showNotification('OTP has expired. Please request a new one.', 'error');
                return;
            }

            if (enteredOTP === this.pendingOTP) {
                // OTP is correct, complete registration
                this.completeRegistration();
            } else {
                this.showNotification('Invalid OTP. Please try again.', 'error');
            }
        } catch (error) {
            this.showNotification('OTP verification failed', 'error');
        }
    }

    completeRegistration() {
        // Complete the registration process
        this.token = 'demo_token_' + Date.now();
        this.user = {
            id: '2',
            username: this.pendingRegistration.username,
            email: this.pendingRegistration.email,
            mobile: this.pendingRegistration.mobile,
            role: 'player'
        };
        
        localStorage.setItem('keno_token', this.token);
        this.hideAuthModal();
        this.startGame();
        this.showNotification('Registration successful! Welcome to Keno Game!', 'success');
        
        // Clear pending data
        this.pendingRegistration = null;
        this.pendingOTP = null;
    }

    async resendOTP() {
        if (!this.pendingRegistration) {
            this.showNotification('No pending registration found', 'error');
            return;
        }

        try {
            await this.sendOTPToWhatsApp(this.pendingRegistration.mobile);
            this.showNotification('OTP resent successfully', 'success');
        } catch (error) {
            this.showNotification('Failed to resend OTP', 'error');
        }
    }

    changeMobile() {
        // Go back to registration form
        this.showAuthModal('register');
        this.pendingRegistration = null;
    }

    async verifyToken() {
        try {
            // In a real app, this would verify the token with the server
            this.user = { id: '1', username: 'admin', role: 'admin' };
            this.startGame();
        } catch (error) {
            this.logout();
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('keno_token');
        this.showWelcomeScreen();
        this.showNotification('Logged out successfully', 'info');
    }

    startGame() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('gameInterface').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('authButtons').style.display = 'none';
        
        // Update user info and balance
        this.updateBalanceDisplay();
        
        this.loadLatestDraw();
        this.loadUserTickets();
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('gameInterface').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('authButtons').style.display = 'flex';
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 3000;
            animation: slideIn 0.3s ease-out;
        `;

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Add CSS for animations and notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    @keyframes pulseIn {
        0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
        }
        50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 10px rgba(102, 126, 234, 0);
        }
        100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
        }
    }

    @keyframes pulseOut {
        0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
        }
        50% {
            transform: scale(0.9);
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
        }
        100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
        }
    }

    @keyframes quickPickSelect {
        0% {
            transform: scale(0) rotate(180deg);
            opacity: 0;
        }
        50% {
            transform: scale(1.2) rotate(90deg);
            opacity: 0.8;
        }
        100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
        }
    }

    @keyframes ticketPurchaseAnim {
        0% {
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            opacity: 0;
        }
        20% {
            transform: translate(-50%, -50%) scale(1.2) rotate(5deg);
            opacity: 1;
        }
        40% {
            transform: translate(-50%, -50%) scale(1) rotate(-2deg);
            opacity: 1;
        }
        60% {
            transform: translate(-50%, -50%) scale(1.05) rotate(1deg);
            opacity: 1;
        }
        80% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 0;
        }
    }

    .ticket-animation-content i {
        font-size: 3rem;
        margin-bottom: 1rem;
        display: block;
    }

    .ticket-animation-content h3 {
        margin-bottom: 0.5rem;
        font-size: 1.5rem;
    }

    .ticket-animation-content p {
        font-size: 1.2rem;
        font-weight: 600;
    }
`;
document.head.appendChild(style);

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new KenoGame();
});