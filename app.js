console.log("Stellar Dashboard App - Version 4 - Loaded");
// Configuration
const HORIZON_SERVER_URL = "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Server(HORIZON_SERVER_URL);

// State Variables
let connectedAddress = null;
let currentBalance = 0;
let isFreighterAvailable = false;
let html5QrCode = null; // Scanner instance reference

// DOM Elements
const btnWalletToggle = document.getElementById("btn-wallet-toggle");
const walletToggleText = document.getElementById("wallet-toggle-text");
const cardWalletDetails = document.getElementById("card-wallet-details");
const btnWalletConnectBody = document.getElementById("btn-wallet-connect-body");

const txtWalletAddress = document.getElementById("txt-wallet-address");
const txtWalletBalance = document.getElementById("txt-wallet-balance");
const btnRefreshBalance = document.getElementById("btn-refresh-balance");
const lnkFriendbot = document.getElementById("lnk-friendbot");

const cardTransaction = document.getElementById("card-transaction");
const formSendTx = document.getElementById("form-send-tx");
const inputRecipient = document.getElementById("input-recipient");
const inputAmount = document.getElementById("input-amount");
const inputMemo = document.getElementById("input-memo");
const btnAmountMax = document.getElementById("btn-amount-max");
const btnSubmitTx = document.getElementById("btn-submit-tx");

const feedbackPanel = document.getElementById("feedback-panel");
const feedbackContent = document.getElementById("feedback-content");

// Level 2 Feature Elements (QR & History)
const btnShowQr = document.getElementById("btn-show-qr");
const modalMyQr = document.getElementById("modal-my-qr");
const btnCloseQrModal = document.getElementById("btn-close-qr-modal");
const txtMyQrAddress = document.getElementById("txt-my-qr-address");
const btnCopyAddressModal = document.getElementById("btn-copy-address-modal");
const myQrCanvas = document.getElementById("my-qr-canvas");

const btnScanQr = document.getElementById("btn-scan-qr");
const modalQrScanner = document.getElementById("modal-qr-scanner");
const btnCloseScannerModal = document.getElementById("btn-close-scanner-modal");
const txtScannerStatus = document.getElementById("txt-scanner-status");
const inputQrFile = document.getElementById("input-qr-file");

const cardTransactionsHistory = document.getElementById("card-transactions-history");
const txHistoryLoading = document.getElementById("tx-history-loading");
const txHistoryEmpty = document.getElementById("tx-history-empty");
const txHistoryList = document.getElementById("tx-history-list");

// Initialize Application
window.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    updateDiagnostics();
    
    initTheme();
    initParticles();
    
    // Wait for Freighter to inject asynchronously (with a timeout of 1.5 seconds)
    const detected = await waitForFreighter(1500);
    
    updateDiagnostics(); // Final update after detection completes
    
    if (detected) {
        isFreighterAvailable = true;
        console.log("Freighter wallet detected.");
        await attemptAutoConnect();
    } else {
        isFreighterAvailable = false;
        console.warn("Freighter wallet is not installed.");
        showFeedback("warning", "Freighter Cüzdanı Tespit Edilemedi", "Uygulamayı tam işlevsellikle kullanabilmek için lütfen tarayıcınıza Freighter eklentisini kurun.");
    }
});

// Wait for Freighter to be injected by the browser extension
async function waitForFreighter(timeoutMs = 1500) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            updateDiagnostics(); // Update variables state in UI at each tick
            
            const hasApi = (
                typeof window.freighterApi !== "undefined" ||
                typeof window.stellar !== "undefined" ||
                typeof window.freighter !== "undefined"
            );
            if (hasApi) {
                clearInterval(interval);
                resolve(true);
            } else if (Date.now() - startTime > timeoutMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });
}

// System Diagnostics logging and presentation helper
function updateDiagnostics() {
    const diagProtocol = document.getElementById("diag-protocol");
    const diagFreighter = document.getElementById("diag-freighter");
    const diagStellar = document.getElementById("diag-stellar");
    const diagFreighterApi = document.getElementById("diag-freighter-api");
    
    if (diagProtocol) {
        diagProtocol.textContent = window.location.protocol;
        if (window.location.protocol === "file:") {
            diagProtocol.style.color = "var(--error)";
            diagProtocol.textContent += " (Freighter'ı Engelleyebilir)";
        } else {
            diagProtocol.style.color = "var(--success)";
        }
    }
    
    const hasStellar = typeof window.stellar !== "undefined";
    const hasFreighterApi = typeof window.freighterApi !== "undefined" || typeof window.freighter !== "undefined";
    const hasAny = hasStellar || hasFreighterApi;
    
    if (diagStellar) {
        diagStellar.textContent = hasStellar ? "Tanımlı (Object)" : "Tanımsız (undefined)";
        diagStellar.style.color = hasStellar ? "var(--success)" : "var(--error)";
    }
    
    if (diagFreighterApi) {
        diagFreighterApi.textContent = hasFreighterApi ? "Tanımlı (Object)" : "Tanımsız (undefined)";
        diagFreighterApi.style.color = hasFreighterApi ? "var(--success)" : "var(--error)";
    }
    
    if (diagFreighter) {
        diagFreighter.textContent = hasAny ? "Tespit Edildi" : "Tespit Edilemedi";
        diagFreighter.style.color = hasAny ? "var(--success)" : "var(--error)";
    }
}



// Setup Interactive Action Event Listeners
function setupEventListeners() {
    // Connect Wallet Buttons
    btnWalletToggle.addEventListener("click", handleWalletToggle);
    btnWalletConnectBody.addEventListener("click", connectWallet);
    
    // Copy Address Button
    const btnCopyAddress = document.getElementById("btn-copy-address");
    if (btnCopyAddress) {
        btnCopyAddress.addEventListener("click", () => {
            copyAddressToClipboard(connectedAddress, btnCopyAddress.querySelector('i'));
        });
    }
    
    // Refresh Balance Button
    if (btnRefreshBalance) {
        btnRefreshBalance.addEventListener("click", fetchAndDisplayBalance);
    }
    
    // Max Amount Shortcut Button
    if (btnAmountMax) {
        btnAmountMax.addEventListener("click", () => {
            // Keep a reserve for transaction fee (0.01 XLM to be extremely safe, though actual fee is 0.00001 XLM)
            const maxSendable = Math.max(0, currentBalance - 0.1);
            inputAmount.value = maxSendable.toFixed(7);
        });
    }
    
    // Send Transaction Form Submission
    formSendTx.addEventListener("submit", handleTransactionSubmission);

    // QR Code Modals
    if (btnShowQr) btnShowQr.addEventListener("click", showMyQrModal);
    if (btnCloseQrModal) btnCloseQrModal.addEventListener("click", closeMyQrModal);
    if (btnCopyAddressModal) btnCopyAddressModal.addEventListener("click", () => {
        copyAddressToClipboard(connectedAddress, btnCopyAddressModal.querySelector('i'));
    });
    
    // QR Scanner
    if (btnScanQr) btnScanQr.addEventListener("click", startQrScanner);
    if (btnCloseScannerModal) btnCloseScannerModal.addEventListener("click", stopQrScanner);
    if (inputQrFile) inputQrFile.addEventListener("change", handleQrFileUpload);
}

// Attempt to Auto-Connect if previously authorized
async function attemptAutoConnect() {
    if (!isFreighterAvailable) return;
    
    try {
        // Retrieve address without showing a popup (checks allowlist status)
        const result = await window.freighterApi.getAddress();
        if (result && result.address) {
            console.log("Auto-connected to:", result.address);
            setConnectedState(result.address);
        }
    } catch (err) {
        console.error("Auto-connect check failed:", err);
    }
}

// Connect / Disconnect Action Toggle
async function handleWalletToggle() {
    if (connectedAddress) {
        // Disconnect Flow
        disconnectWallet();
    } else {
        // Connect Flow
        await connectWallet();
    }
}

// Connect Wallet through Freighter
async function connectWallet() {
    if (!isFreighterAvailable) {
        showFeedback("error", "Eklenti Eksik", "Lütfen önce tarayıcınıza Freighter cüzdan eklentisini kurun.");
        return;
    }
    
    showFeedback("loading", "Cüzdan Bağlantısı Bekleniyor", "Lütfen Freighter cüzdanınızda bağlantıyı onaylayın.");
    
    try {
        const result = await window.freighterApi.requestAccess();
        if (result && result.address) {
            setConnectedState(result.address);
            hideFeedback();
        } else if (result && result.error) {
            showFeedback("error", "Bağlantı Hatası", `Cüzdan bağlantısı reddedildi: ${result.error}`);
        } else {
            showFeedback("error", "Bağlantı Hatası", "Cüzdan bağlantısı kurulamadı.");
        }
    } catch (err) {
        console.error("Wallet connection failed:", err);
        showFeedback("error", "Sistemsel Hata", `Cüzdan bağlantı isteği başarısız: ${err.message || err}`);
    }
}

// Disconnect Wallet (Local UI State Reset)
function disconnectWallet() {
    connectedAddress = null;
    currentBalance = 0;
    
    // Reset Header Button
    btnWalletToggle.classList.remove("connected");
    walletToggleText.textContent = "Cüzdanı Bağla";
    
    // Reset Details Card State
    cardWalletDetails.classList.remove("state-connected");
    cardWalletDetails.classList.add("state-disconnected");
    
    // Reset Wallet Text Fields
    txtWalletAddress.textContent = "G...";
    txtWalletBalance.textContent = "0.00";
    
    // Disable Form Input Elements
    toggleFormInputs(false);
    formSendTx.reset();
    
    // Reset History Card
    cardTransactionsHistory.classList.add("disabled");
    txHistoryEmpty.classList.remove("hidden");
    txHistoryList.classList.add("hidden");
    txHistoryLoading.classList.add("hidden");
    
    hideFeedback();
    console.log("Wallet disconnected.");
}

// Transition UI to Connected State
async function setConnectedState(address) {
    connectedAddress = address;
    
    // Update Header Button
    btnWalletToggle.classList.add("connected");
    walletToggleText.textContent = truncateAddress(address);
    
    // Update Details Card State
    cardWalletDetails.classList.remove("state-disconnected");
    cardWalletDetails.classList.add("state-connected");
    
    // Set Address display
    txtWalletAddress.textContent = address;
    
    // Update Identicon
    const identiconSvg = document.getElementById("wallet-identicon");
    if (identiconSvg && typeof jdenticon !== 'undefined') {
        identiconSvg.style.display = "block";
        jdenticon.update(identiconSvg, address);
    }
    
    // Setup Friendbot link
    lnkFriendbot.href = `https://laboratory.stellar.org/#account-creator?network=test&value=${address}`;
    
    // Enable Form Inputs
    toggleFormInputs(true);
    
    // Fetch XLM Balance & History
    await fetchAndDisplayBalance();
    fetchTransactionHistory(address);
}

// Enable or Disable Form Input Fields
function toggleFormInputs(enabled) {
    if (enabled) {
        cardTransaction.classList.remove("disabled");
        inputRecipient.removeAttribute("disabled");
        inputAmount.removeAttribute("disabled");
        inputMemo.removeAttribute("disabled");
        btnAmountMax.removeAttribute("disabled");
        btnSubmitTx.removeAttribute("disabled");
        btnScanQr.removeAttribute("disabled");
    } else {
        cardTransaction.classList.add("disabled");
        inputRecipient.setAttribute("disabled", "true");
        inputAmount.setAttribute("disabled", "true");
        inputMemo.setAttribute("disabled", "true");
        btnAmountMax.setAttribute("disabled", "true");
        btnSubmitTx.setAttribute("disabled", "true");
        btnScanQr.setAttribute("disabled", "true");
    }
}

// Fetch XLM Balance from Horizon Network
async function fetchAndDisplayBalance() {
    if (!connectedAddress) return;
    
    // Visual indicator of loading/refreshing balance
    txtWalletBalance.classList.add("text-muted");
    const refreshIcon = btnRefreshBalance.querySelector("i");
    if (refreshIcon) refreshIcon.classList.add("anim-spin");
    
    try {
        const account = await server.loadAccount(connectedAddress);
        const nativeBalanceObj = account.balances.find(b => b.asset_type === "native");
        
        if (nativeBalanceObj) {
            const rawBalance = parseFloat(nativeBalanceObj.balance);
            currentBalance = rawBalance;
            
            // Nice counter animation or immediate presentation
            animateValue(txtWalletBalance, 0, rawBalance, 800);
        } else {
            txtWalletBalance.textContent = "0.0000000";
            currentBalance = 0;
        }
    } catch (err) {
        console.error("Error loading account balances:", err);
        // If account is not created yet (needs funding)
        if (err.status === 404) {
            txtWalletBalance.textContent = "Oluşturulmamış Hesap (0.00 XLM)";
            currentBalance = 0;
            showFeedback("warning", "Hesap Aktif Değil", "Bu hesap Stellar Testnet ağında henüz oluşturulmamış. İşlem yapabilmek için lütfen 'Friendbot ile XLM Al' butonuna tıklayarak hesabınızı fonlayın.");
        } else {
            showFeedback("error", "Bakiye Alınamadı", `Hesap verileri ağdan çekilirken hata oluştu: ${err.message || err}`);
        }
    } finally {
        txtWalletBalance.classList.remove("text-muted");
        if (refreshIcon) refreshIcon.classList.remove("anim-spin");
    }
}

// Handle Transaction Form Submit Flow
async function handleTransactionSubmission(event) {
    event.preventDefault();
    hideFeedback();
    
    const recipient = inputRecipient.value.trim();
    const amountStr = inputAmount.value.trim();
    const memoText = inputMemo.value.trim();
    
    // 1. Inputs validation
    if (!connectedAddress) {
        showFeedback("error", "Hata", "Lütfen önce cüzdanınızı bağlayın.");
        return;
    }
    
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
        showFeedback("error", "Geçersiz Adres", "Lütfen geçerli bir Stellar public key girin (G ile başlar, 56 karakterdir).");
        inputRecipient.focus();
        return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        showFeedback("error", "Geçersiz Tutar", "Lütfen sıfırdan büyük geçerli bir XLM tutarı girin.");
        inputAmount.focus();
        return;
    }
    
    if (amount > currentBalance) {
        showFeedback("error", "Bakiye Yetersiz", `Göndermek istediğiniz tutar (${amount} XLM) mevcut bakiyenizden (${currentBalance} XLM) fazladır.`);
        inputAmount.focus();
        return;
    }
    
    // Loading State
    setSubmitButtonLoading(true);
    showFeedback("loading", "İşlem Hazırlanıyor", "Stellar ağından hesap bilgileri alınıyor ve işlem oluşturuluyor...");
    
    try {
        // 2. Build Transaction
        const sourceAccount = await server.loadAccount(connectedAddress);
        const baseFee = await server.fetchBaseFee();
        
        let txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: baseFee,
            networkPassphrase: "Test SDF Network ; September 2015"
        })
        .addOperation(StellarSdk.Operation.payment({
            destination: recipient,
            asset: StellarSdk.Asset.native(),
            amount: amount.toFixed(7) // Stellar accepts up to 7 decimals
        }))
        .setTimeout(60); // transaction expires in 60s
        
        if (memoText) {
            txBuilder.addMemo(StellarSdk.Memo.text(memoText));
        }
        
        const transaction = txBuilder.build();
        const xdr = transaction.toXDR();
        console.log("TX Passphrase:", transaction.networkPassphrase);
        console.log("XDR:", xdr);
        
        // 3. User Signing Dialog
        showFeedback("loading", "Onay Bekleniyor", "Lütfen tarayıcınızın Freighter penceresinde işlemi imzalayın.");
        
        const signResult = await window.freighterApi.signTransaction(xdr, { 
            network: "TESTNET",
            networkPassphrase: "Test SDF Network ; September 2015"
        });
        
        if (signResult.error) {
            const errorMsg = typeof signResult.error === 'object' 
                ? (signResult.error.message || JSON.stringify(signResult.error)) 
                : signResult.error;
            throw new Error(`İmzalama reddedildi: ${errorMsg}`);
        }
        
        // 4. Submit Transaction to Testnet
        showFeedback("loading", "İşlem Ağa Gönderiliyor", "İmzalanmış işlem Stellar test ağına iletiliyor...");
        
        const signedTx = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, "Test SDF Network ; September 2015");
        const result = await server.submitTransaction(signedTx);
        
        // 5. Success State
        showFeedback("success", "İşlem Başarıyla Gerçekleşti", `<strong>${amount} XLM</strong> başarıyla alıcı adrese gönderildi.`, result.hash);
        
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#5850ec', '#10b981', '#f59e0b']
            });
        }
        
        // Refresh balance and history, and reset form
        formSendTx.reset();
        await fetchAndDisplayBalance();
        fetchTransactionHistory(connectedAddress);
        
    } catch (err) {
        console.error("Transaction flow error:", err);
        
        // Extract detailed Horizon error codes if available
        let detailedError = "";
        if (err && typeof err === 'object') {
            detailedError = err.message || JSON.stringify(err);
        } else {
            detailedError = err;
        }
        
        if (err.response && err.response.data && err.response.data.extras && err.response.data.extras.result_codes) {
            const resultCodes = err.response.data.extras.result_codes;
            let codes = [];
            if (resultCodes.transaction) codes.push(`Tx: ${resultCodes.transaction}`);
            if (resultCodes.operations) codes.push(`Op: ${resultCodes.operations.join(", ")}`);
            detailedError = `Ağ Hatası (${codes.join(" | ")})`;
        }
        
        showFeedback("error", "İşlem Başarısız", `İşlem gerçekleştirilirken hata oluştu: ${detailedError}`);
    } finally {
        setSubmitButtonLoading(false);
    }
}

// Display Feedback messages to the user
function showFeedback(type, title, description, txHash = null) {
    feedbackPanel.classList.remove("hidden");
    
    // Clear dynamic class states
    feedbackPanel.className = "card feedback-card";
    
    let iconHTML = "";
    
    if (type === "loading") {
        feedbackPanel.classList.add("feedback-loading");
        iconHTML = '<i class="fa-solid fa-circle-notch spinner feedback-status-icon"></i>';
    } else if (type === "success") {
        feedbackPanel.classList.add("feedback-success");
        iconHTML = '<i class="fa-solid fa-circle-check feedback-status-icon"></i>';
    } else if (type === "error") {
        feedbackPanel.classList.add("feedback-error");
        iconHTML = '<i class="fa-solid fa-circle-xmark feedback-status-icon"></i>';
    } else if (type === "warning") {
        feedbackPanel.classList.add("feedback-card"); // neutral styled panel with warning content
        iconHTML = '<i class="fa-solid fa-circle-exclamation feedback-status-icon" style="color: var(--warning);"></i>';
    }
    
    let txHashLinkHTML = "";
    if (txHash) {
        txHashLinkHTML = `
            <div style="margin-top: 12px;">
                <a href="https://stellar.expert/explorer/testnet/tx/${txHash}" target="_blank" rel="noopener noreferrer" class="tx-hash-link">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    İşlemi StellarExpert'te Görüntüle
                </a>
            </div>
            <p style="font-size: 11px; margin-top: 6px; color: var(--text-muted);">Hash: ${txHash}</p>
        `;
    }
    
    feedbackContent.innerHTML = `
        <div class="feedback-content-wrapper">
            ${iconHTML}
            <div class="feedback-details">
                <h3>${title}</h3>
                <p>${description}</p>
                ${txHashLinkHTML}
            </div>
        </div>
    `;
    
    // Scroll feedback into view
    feedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Hide feedback card
function hideFeedback() {
    feedbackPanel.classList.add("hidden");
}

// Submit button loading animation state toggler
function setSubmitButtonLoading(isLoading) {
    if (isLoading) {
        btnSubmitTx.setAttribute("disabled", "true");
        btnSubmitTx.innerHTML = `
            <i class="fa-solid fa-circle-notch spinner"></i>
            <span>Gönderiliyor...</span>
        `;
    } else {
        btnSubmitTx.removeAttribute("disabled");
        btnSubmitTx.innerHTML = `
            <span>Gönderimi Başlat</span>
            <i class="fa-solid fa-arrow-right"></i>
        `;
    }
}

// Utilities
function truncateAddress(address) {
    if (!address) return "";
    return `${address.substring(0, 5)}...${address.substring(address.length - 4)}`;
}

function copyAddressToClipboard(address, iconElement) {
    if (!address) return;
    
    navigator.clipboard.writeText(address).then(() => {
        const originalClass = iconElement.className;
        iconElement.className = "fa-solid fa-check";
        iconElement.style.color = "var(--success)";
        
        setTimeout(() => {
            iconElement.className = originalClass;
            iconElement.style.color = "";
        }, 2000);
    }).catch(err => {
        console.error("Address copy failed:", err);
    });
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = progress * (end - start) + start;
        obj.innerHTML = currentVal.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 7 });
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// Level 2 Functions (History & QR Code Suite)
// ==========================================

// Fetch Account Transaction History (Payments) from Horizon
async function fetchTransactionHistory(address) {
    if (!address) return;
    
    // Toggle Loading Indicator
    txHistoryLoading.classList.remove("hidden");
    txHistoryEmpty.classList.add("hidden");
    txHistoryList.classList.add("hidden");
    
    try {
        const payments = await server.payments().forAccount(address).order("desc").limit(10).call();
        
        txHistoryList.innerHTML = "";
        
        if (payments && payments.records && payments.records.length > 0) {
            payments.records.forEach(op => {
                let isIncoming = false;
                let displayAddress = "";
                let amount = "0.00";
                let typeText = "";
                
                if (op.type === "payment") {
                    amount = op.amount;
                    if (op.to === address) {
                        isIncoming = true;
                        displayAddress = op.from;
                        typeText = "Gelen Ödeme";
                    } else {
                        isIncoming = false;
                        displayAddress = op.to;
                        typeText = "Giden Ödeme";
                    }
                } else if (op.type === "create_account") {
                    amount = op.starting_balance;
                    if (op.account === address) {
                        isIncoming = true;
                        displayAddress = op.funder;
                        typeText = "Hesap Fonlama";
                    } else {
                        isIncoming = false;
                        displayAddress = op.account;
                        typeText = "Hesap Oluşturma";
                    }
                } else if (op.type === "account_merge") {
                    amount = op.amount || "Tümü";
                    if (op.into === address) {
                        isIncoming = true;
                        displayAddress = op.account;
                        typeText = "Hesap Birleştirme";
                    } else {
                        isIncoming = false;
                        displayAddress = op.into;
                        typeText = "Hesap Birleştirme";
                    }
                } else {
                    return; // Skip non-payment operations
                }
                
                const timeText = op.created_at ? new Date(op.created_at).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }) + " " + new Date(op.created_at).toLocaleDateString("tr-TR", { day: 'numeric', month: 'short' }) : "-";
                
                const itemHTML = `
                    <li class="tx-history-item">
                        <div class="tx-item-left">
                            <div class="tx-icon-badge ${isIncoming ? 'in' : 'out'}" style="padding: 2px; background: white;">
                                <svg width="28" height="28" data-jdenticon-value="${displayAddress}"></svg>
                            </div>
                            <div class="tx-item-details">
                                <span class="tx-item-title">${typeText}</span>
                                <span class="tx-item-address">${isIncoming ? 'Gönderen' : 'Alıcı'}: ${truncateAddress(displayAddress)}</span>
                            </div>
                        </div>
                        <div class="tx-item-right">
                            <span class="tx-item-amount ${isIncoming ? 'in' : 'out'}">${isIncoming ? '+' : '-'}${parseFloat(amount).toFixed(4)} XLM</span>
                            <span class="tx-item-time">${timeText}</span>
                        </div>
                    </li>
                `;
                txHistoryList.insertAdjacentHTML("beforeend", itemHTML);
            });
            
            if (typeof jdenticon !== 'undefined') {
                jdenticon();
            }
            
            // Show list
            txHistoryList.classList.remove("hidden");
            cardTransactionsHistory.classList.remove("disabled");
        } else {
            txHistoryEmpty.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Error loading transaction history:", err);
        txHistoryEmpty.classList.remove("hidden");
        txHistoryEmpty.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="display: block; font-size: 28px; margin-bottom: 12px; color: var(--error);"></i>
            İşlem geçmişi alınırken hata oluştu.
        `;
    } finally {
        txHistoryLoading.classList.add("hidden");
    }
}

// Generate & Display Connected Account's QR Code
function showMyQrModal() {
    if (!connectedAddress) return;
    
    txtMyQrAddress.textContent = connectedAddress;
    
    // Draw canvas QR
    new QRious({
        element: myQrCanvas,
        value: connectedAddress,
        size: 190,
        background: 'white',
        foreground: '#0b0c10',
        level: 'H'
    });
    
    modalMyQr.classList.remove("hidden");
}

function closeMyQrModal() {
    modalMyQr.classList.add("hidden");
}

// Start QR Scanner using html5-qrcode library
function startQrScanner() {
    if (!connectedAddress) return;
    
    modalQrScanner.classList.remove("hidden");
    txtScannerStatus.textContent = "Kamera erişimi aranıyor...";
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("scanner-reader");
    }
    
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            inputRecipient.value = decodedText;
            stopQrScanner();
        },
        () => {
            // Silently swallow scanning errors (no code in frame)
        }
    ).then(() => {
        txtScannerStatus.textContent = "Kamerayı alıcının QR koduna hizalayın.";
    }).catch(err => {
        console.error("Camera start failed:", err);
        txtScannerStatus.innerHTML = `Kamera başlatılamadı.<br><span style="font-size: 11px; color: var(--error);">${err}</span>`;
    });
}

function stopQrScanner() {
    modalQrScanner.classList.add("hidden");
    
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            console.log("Scanner camera stream released.");
        }).catch(err => {
            console.error("Failed to stop scanner:", err);
        });
    }
}

// Import & Parse QR Code from image file
function handleQrFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    txtScannerStatus.textContent = "Görsel işleniyor...";
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("scanner-reader");
    }
    
    html5QrCode.scanFile(file, true)
    .then(decodedText => {
        inputRecipient.value = decodedText;
        stopQrScanner();
        event.target.value = "";
    })
    .catch(err => {
        console.error("QR Code image parse failed:", err);
        txtScannerStatus.textContent = "Görselden QR kod okunamadı. Lütfen başka bir görsel yükleyin.";
        event.target.value = "";
    });
}

// ==========================================
// Visual Enhancements (Category 1)
// ==========================================

function initTheme() {
    const btnThemeToggle = document.getElementById("btn-theme-toggle");
    if (!btnThemeToggle) return;
    
    // Check saved theme
    const savedTheme = localStorage.getItem("novastellar_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(btnThemeToggle, savedTheme);
    
    btnThemeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("novastellar_theme", newTheme);
        updateThemeIcon(btnThemeToggle, newTheme);
    });
}

function updateThemeIcon(btn, theme) {
    if (theme === "light") {
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
}

function initParticles() {
    if (typeof tsParticles !== 'undefined') {
        tsParticles.load("tsparticles", {
            preset: "stars",
            background: { color: "transparent" },
            particles: {
                number: { value: 120 },
                color: { value: "#ffffff" },
                links: { enable: true, opacity: 0.1 },
                move: { enable: true, speed: 0.4 }
            }
        });
    }
}
