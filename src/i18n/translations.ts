import { Language } from '../types';

export type TranslationKey =
  | 'app_title'
  | 'tagline'
  | 'welcome_title'
  | 'welcome_subtitle'
  | 'welcome_benefit1'
  | 'welcome_benefit2'
  | 'welcome_benefit3'
  | 'get_started'
  | 'select_language'
  | 'language_subtitle'
  | 'english'
  | 'bangla'
  | 'hindi'
  | 'phone_login'
  | 'enter_mobile'
  | 'mobile_placeholder'
  | 'send_otp'
  | 'enter_otp'
  | 'verify_otp'
  | 'resend_otp'
  | 'welcome'
  | 'setup_shop_title'
  | 'shop_name'
  | 'shop_name_placeholder'
  | 'owner_name'
  | 'owner_name_placeholder'
  | 'phone_number'
  | 'whatsapp_number'
  | 'email_optional'
  | 'business_type'
  | 'business_type_placeholder'
  | 'country'
  | 'state_district'
  | 'city'
  | 'full_address'
  | 'postal_code'
  | 'currency_code'
  | 'save_continue'
  | 'save_profile'
  | 'total_due'
  | 'total_collected'
  | 'total_customers'
  | 'search_placeholder'
  | 'add_new_transaction'
  | 'add_customer'
  | 'customer_name'
  | 'customer_phone'
  | 'name_placeholder'
  | 'phone_placeholder'
  | 'duplicate_name_warning'
  | 'auto_label_info'
  | 'select_customer'
  | 'amount'
  | 'credit_given'
  | 'payment_received'
  | 'note_optional'
  | 'save_transaction'
  | 'receipt_title'
  | 'send_whatsapp'
  | 'due_amount'
  | 'all_settled'
  | 'owe_money'
  | 'paid_up'
  | 'transaction_history'
  | 'no_transactions'
  | 'send_again'
  | 'date'
  | 'type'
  | 'back'
  | 'logout'
  | 'currency_symbol'
  | 'currency_name'
  | 'all'
  | 'owes_you'
  | 'all_clear'
  | 'change_lang'
  | 'demo_mode'
  | 'demo_notice'
  | 'dev_mode_title'
  | 'dev_mode_sub'
  | 'profile_title'
  | 'edit_profile'
  | 'shop_logo'
  | 'shop_photo'
  | 'owner_signature'
  | 'upload_image'
  | 'change_image'
  | 'remove_image'
  | 'gst_enabled'
  | 'gst_number'
  | 'gst_placeholder'
  | 'search_country'
  | 'select_country'
  | 'profile_saved_success'
  | 'invalid_phone_error'
  | 'invalid_otp_error'
  | 'customer_added_success'
  | 'clear_keypad'
  | 'customer_owes'
  | 'customer_paid'
  | 'no_customer_found'
  | 'add_customer_prompt'
  | 'step_counter'
  | 'trusted_tagline'
  | 'nav_home'
  | 'nav_customers'
  | 'nav_history'
  | 'nav_reports'
  | 'nav_profile'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'all_time'
  | 'custom_range'
  | 'date_filter'
  | 'tx_type_filter'
  | 'void_correction'
  | 'void_transaction'
  | 'void_reason'
  | 'void_reason_placeholder'
  | 'confirm_void'
  | 'void_notice'
  | 'audit_trail'
  | 'previous_balance'
  | 'new_balance'
  | 'reports_title'
  | 'collection_rate'
  | 'top_due_customers'
  | 'download_report'
  | 'business_summary'
  | 'tx_id'
  | 'no_history_found'
  | 'recovery_rate'
  | 'quick_actions'
  | 'select_gst_rate'
  | 'customer_state'
  | 'intra_state_tax'
  | 'inter_state_tax'
  | 'cgst'
  | 'sgst'
  | 'igst'
  | 'base_amount'
  | 'tax_amount'
  | 'total_with_tax'
  | 'print_receipt'
  | 'copy_receipt'
  | 'receipt_copied'
  | 'share_receipt'
  | 'wa_notice'
  | 'download_pdf'
  | 'edit_phone_number'
  | 'resend_in_seconds'
  | 'otp_sent_to'
  | 'receipt_owner'
  | 'receipt_address'
  | 'receipt_customer'
  | 'receipt_thank_you'
  // AI Handwriting Scanner Keys (v4)
  | 'scan_ledger_page'
  | 'scan_ledger_title'
  | 'scan_ledger_subtitle'
  | 'upload_ledger_photo'
  | 'ai_processing'
  | 'name_detected'
  | 'amount_detected'
  | 'matched_customer'
  | 'select_matching_customer'
  | 'create_new_customer_prompt'
  | 'confirm_and_save'
  | 'ledger_photo_proof'
  // Google OAuth & Session UX Keys
  | 'continue_with_google'
  | 'or_sign_in_with'
  | 'welcome_back_account'
  | 'google_signin_error'
  | 'continue_as';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    app_title: 'Smart Khata',
    tagline: 'Digital Credit & Ledger Book',
    welcome_title: 'Smart Khata for Your Business',
    welcome_subtitle: 'The simplest digital credit ledger built for shopkeepers and small businesses.',
    welcome_benefit1: 'Replace paper ledgers with zero mathematical errors',
    welcome_benefit2: 'Send instant WhatsApp receipts for every credit & payment',
    welcome_benefit3: 'Works 100% in your language — Bangla, English, or Hindi',
    get_started: 'Get Started',
    select_language: 'Select App Language',
    language_subtitle: 'Choose your preferred language to continue',
    english: 'English',
    bangla: 'বাংলা (Bangla)',
    hindi: 'हिंदी (Hindi)',
    phone_login: 'Mobile Phone Login',
    enter_mobile: 'Enter your mobile number to log in',
    mobile_placeholder: '1700000000',
    send_otp: 'Send OTP Code',
    enter_otp: 'Enter 6-Digit OTP',
    verify_otp: 'Verify & Login',
    resend_otp: 'Resend OTP',
    welcome: 'Welcome to Smart Khata!',
    setup_shop_title: 'Set Up Your Shop Profile',
    shop_name: 'Shop Name',
    shop_name_placeholder: 'Enter store name',
    owner_name: 'Shop Owner Name',
    owner_name_placeholder: 'Enter your name',
    phone_number: 'Mobile Phone Number',
    whatsapp_number: 'WhatsApp Number',
    email_optional: 'Email Address (Optional)',
    business_type: 'Business Category',
    business_type_placeholder: 'e.g. Grocery, Pharmacy, Clothing',
    country: 'Country',
    state_district: 'State / District',
    city: 'City / Town',
    full_address: 'Shop Full Address',
    postal_code: 'Postal Code',
    currency_code: 'Currency',
    save_continue: 'Save & Continue',
    save_profile: 'Save Profile Changes',
    total_due: 'Total Due (Owed to You)',
    total_collected: 'Total Paid / Settled',
    total_customers: 'Total Customers',
    search_placeholder: 'Search customer by name or phone number...',
    add_new_transaction: 'New Transaction',
    add_customer: 'Add New Customer',
    customer_name: 'Customer Name',
    customer_phone: 'Customer Mobile Number',
    name_placeholder: 'Enter customer name',
    phone_placeholder: '1800000000',
    duplicate_name_warning: 'You already have a customer named "{name}". To tell them apart, please add extra detail — like their area, father\'s name, or phone last digits.',
    auto_label_info: 'Unique display label created:',
    select_customer: 'Select Customer',
    amount: 'Enter Amount',
    credit_given: 'Gave Credit',
    payment_received: 'Got Payment',
    note_optional: 'Note / Item details (Optional)',
    save_transaction: 'Save Transaction',
    receipt_title: 'Transaction Receipt',
    send_whatsapp: 'Send Receipt on WhatsApp',
    due_amount: 'Current Due Balance',
    all_settled: 'All Settled',
    owe_money: 'Owes Money',
    paid_up: 'Paid Up / Clear',
    transaction_history: 'Transaction History',
    no_transactions: 'No transactions found for this customer.',
    send_again: 'Send Receipt Again',
    date: 'Date & Time',
    type: 'Transaction Type',
    back: 'Back',
    logout: 'Log Out',
    currency_symbol: '$',
    currency_name: 'USD',
    all: 'All',
    owes_you: 'Owes You',
    all_clear: 'All Clear',
    change_lang: 'Language',
    demo_mode: 'Demo / Preview Mode',
    demo_notice: 'Running in demo mode. Configure .env with Supabase credentials for cloud sync.',
    dev_mode_title: 'DEVELOPMENT MODE',
    dev_mode_sub: 'SMS Bypassed • Enter any 6-digit OTP code to log in',
    profile_title: 'Shop Owner Profile',
    edit_profile: 'Edit Profile & Settings',
    shop_logo: 'Shop Logo',
    shop_photo: 'Shop Front Photo',
    owner_signature: 'Digital Signature',
    upload_image: 'Upload Image',
    change_image: 'Change Image',
    remove_image: 'Remove',
    gst_enabled: 'Enable GST / Tax Filing',
    gst_number: 'GSTIN / Trade License Number',
    gst_placeholder: 'e.g. 22AAAAA0000A1Z5',
    search_country: 'Search country or code...',
    select_country: 'Select Country',
    profile_saved_success: 'Shop Profile updated successfully!',
    invalid_phone_error: 'Please enter a valid mobile number.',
    invalid_otp_error: 'Invalid OTP verification code.',
    customer_added_success: 'New customer added successfully.',
    clear_keypad: 'CLEAR',
    customer_owes: 'Customer Due',
    customer_paid: 'Customer Paid',
    no_customer_found: 'No customer found.',
    add_customer_prompt: 'Tap "+ Add New Customer" above.',
    step_counter: 'Step',
    trusted_tagline: 'Simple • Secure • Trusted Ledger',
    nav_home: 'Home',
    nav_customers: 'Customers',
    nav_history: 'History',
    nav_reports: 'Reports',
    nav_profile: 'Settings',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    all_time: 'All Time',
    custom_range: 'Custom Date Range',
    date_filter: 'Time Period',
    tx_type_filter: 'Transaction Type',
    void_correction: 'Void / Correction',
    void_transaction: 'Void / Correct Entry',
    void_reason: 'Reason for Void/Correction',
    void_reason_placeholder: 'e.g. Mistaken amount typed or duplicated entry',
    confirm_void: 'Confirm Void Entry',
    void_notice: 'Financial history is never deleted. This creates a reversible correction entry in the audit trail.',
    audit_trail: 'Audit Log',
    previous_balance: 'Previous Balance',
    new_balance: 'New Balance',
    reports_title: 'Business Reports & Statements',
    collection_rate: 'Recovery Rate',
    top_due_customers: 'Top Customers with Dues',
    download_report: 'Share Summary Report',
    business_summary: 'Overall Business Summary',
    tx_id: 'TX ID',
    no_history_found: 'No transaction history records match your filters.',
    recovery_rate: 'Collection Efficiency',
    quick_actions: 'Quick Actions',
    select_gst_rate: 'Select GST Rate (%)',
    customer_state: 'Customer State',
    intra_state_tax: 'Intra-State GST (CGST + SGST)',
    inter_state_tax: 'Inter-State GST (IGST)',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    base_amount: 'Subtotal / Base Amount',
    tax_amount: 'Total GST Amount',
    total_with_tax: 'Grand Total Amount',
    print_receipt: 'Print Receipt',
    copy_receipt: 'Copy Receipt Text',
    receipt_copied: 'Receipt text copied to clipboard!',
    share_receipt: 'Share Receipt',
    wa_notice: 'Opens WhatsApp with pre-filled receipt text. Please tap Send inside WhatsApp.',
    download_pdf: 'Download PDF',
    edit_phone_number: 'Edit Phone Number',
    resend_in_seconds: 'Resend OTP in {seconds}s',
    otp_sent_to: 'OTP code sent to {phone}',
    receipt_owner: 'Owner',
    receipt_address: 'Address',
    receipt_customer: 'Customer',
    receipt_thank_you: 'Thank you!',
    scan_ledger_page: 'Scan Ledger Page',
    scan_ledger_title: 'AI Handwriting Scanner',
    scan_ledger_subtitle: 'Upload or take a photo of handwritten notebook entries',
    upload_ledger_photo: 'Upload / Take Photo',
    ai_processing: 'Analyzing handwriting with AI...',
    name_detected: 'Name Detected:',
    amount_detected: 'Amount Detected:',
    matched_customer: 'Matched Existing Customer:',
    select_matching_customer: 'Multiple matching customers found:',
    create_new_customer_prompt: 'No match found. Create new customer:',
    confirm_and_save: 'Confirm & Save Transaction',
    ledger_photo_proof: 'Handwritten Notebook Proof',
    continue_with_google: 'Continue with Google',
    or_sign_in_with: 'Or Sign In With',
    welcome_back_account: 'Welcome Back ({email})',
    google_signin_error: 'Google sign-in could not be completed. Please try again.',
    continue_as: 'Continue as {name}',
  },
  bn: {
    app_title: 'স্মার্ট খাতা',
    tagline: 'ডিজিটাল বাকি ও হিসাবের খাতা',
    welcome_title: 'আপনার ব্যবসার জন্য স্মার্ট খাতা',
    welcome_subtitle: 'দোকানদার ও ক্ষুদ্র ব্যবসায়ীদের জন্য সবচেয়ে সহজ ডিজিটাল বাকি খাতা।',
    welcome_benefit1: 'হাতে লেখা খাতার হিসাব বাদ দিয়ে ভুলমুক্ত নির্ভুল হিসাব রাখুন',
    welcome_benefit2: 'প্রতিটি লেনদেনের পর কাস্টমারকে দিন মেসেজ ও হোয়াটসঅ্যাপ রসিদ',
    welcome_benefit3: 'আপনার নিজের ভাষায় ১০০% সহজ — বাংলা, ইংরেজি বা হিন্দি',
    get_started: 'শুরু করুন',
    select_language: 'অ্যাপের ভাষা বেছে নিন',
    language_subtitle: 'সামনে এগিয়ে যেতে আপনার পছন্দের ভাষা নির্বাচন করুন',
    english: 'English',
    bangla: 'বাংলা (Bangla)',
    hindi: 'हिंदी (Hindi)',
    phone_login: 'মোবাইল নম্বর দিয়ে লগইন',
    enter_mobile: 'লগইন করতে আপনার নম্বর লিখুন',
    mobile_placeholder: '১৭০০০০০০০০',
    send_otp: 'ওটিপি (OTP) পাঠান',
    enter_otp: '৬ সংখ্যার ওটিপি লিখুন',
    verify_otp: 'যাচাই করুন ও লগইন',
    resend_otp: 'আবার ওটিপি পাঠান',
    welcome: 'স্মার্ট খাতায় আপনাকে স্বাগতম!',
    setup_shop_title: 'আপনার দোকানের প্রোফাইল সেটআপ করুন',
    shop_name: 'দোকানের নাম',
    shop_name_placeholder: 'দোকানের নাম লিখুন',
    owner_name: 'দোকানদারের নাম',
    owner_name_placeholder: 'আপনার নাম লিখুন',
    phone_number: 'মোবাইল নম্বর',
    whatsapp_number: 'হোয়াটসঅ্যাপ নম্বর',
    email_optional: 'ইমেইল অ্যাড্রেস (ঐচ্ছিক)',
    business_type: 'ব্যবসার ধরন',
    business_type_placeholder: 'যেমন: মুদি দোকান, ফার্মেসি, কাপড়ের দোকান',
    country: 'দেশ',
    state_district: 'জেলা / বিভাগ',
    city: 'শহর / থানা',
    full_address: 'দোকানের ঠিকানা',
    postal_code: 'পোস্টাল কোড',
    currency_code: 'মুদ্রা',
    save_continue: 'সংরক্ষণ ও এগিয়ে যান',
    save_profile: 'প্রোফাইল সেভ করুন',
    total_due: 'মোট বাকি পাওনা',
    total_collected: 'মোট জমা পাওয়া',
    total_customers: 'মোট কাস্টমার',
    search_placeholder: 'নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...',
    add_new_transaction: 'নতুন লেনদেন',
    add_customer: 'নতুন কাস্টমার যোগ করুন',
    customer_name: 'কাস্টমারের নাম',
    customer_phone: 'কাস্টমারের মোবাইল নম্বর',
    name_placeholder: 'কাস্টমারের নাম লিখুন',
    phone_placeholder: '১৮০০০০০০০০',
    duplicate_name_warning: '"{name}" নামে ইতিমধ্যে একজন কাস্টমার আছে। চিনতে সুবিধা হতে নামের সাথে এলাকা, বাবার নাম বা মোবাইল নম্বরের শেষ ৪ সংখ্যা যোগ করুন।',
    auto_label_info: 'স্বয়ংক্রিয় আলাদা নাম তৈরি হয়েছে:',
    select_customer: 'কাস্টমার নির্বাচন করুন',
    amount: 'পরিমাণ লিখুন',
    credit_given: 'বাকি দেওয়া হলো',
    payment_received: 'টাকা পাওয়া গেল (জমা)',
    note_optional: 'নোট / পণ্যের বিবরণ (ঐচ্ছিক)',
    save_transaction: 'লেনদেন সেভ করুন',
    receipt_title: 'লেনদেনের রসিদ',
    send_whatsapp: 'হোয়াটসঅ্যাপে রসিদ পাঠান',
    due_amount: 'বর্তমান বাকি পাওনা',
    all_settled: 'সব হিসাব পরিশোধিত',
    owe_money: 'বাকি আছে',
    paid_up: 'পরিশোধিত / ক্লিয়ার',
    transaction_history: 'লেনদেনের ইতিহাস',
    no_transactions: 'এই কাস্টমারের কোনো লেনদেন পাওয়া যায়নি।',
    send_again: 'আবার রসিদ পাঠান',
    date: 'তারিখ ও সময়',
    type: 'লেনদেনের ধরন',
    back: 'ফিরে যান',
    logout: 'লগআউট',
    currency_symbol: '৳',
    currency_name: 'টাকা',
    all: 'সবাই',
    owes_you: 'বাকি আছে',
    all_clear: 'পরিশোধিত',
    change_lang: 'ভাষা',
    demo_mode: 'ডেমো মোড',
    demo_notice: 'ডেমো মোডে চলছে। ক্লাউড ডেটার জন্য .env সেটআপ করুন।',
    dev_mode_title: 'ডেভেলপমেন্ট মোড',
    dev_mode_sub: 'এসএমএস ছাড়াই যে কোনো ৬ সংখ্যার ওটিপি দিয়ে লগইন করুন',
    profile_title: 'দোকানদারের প্রোফাইল',
    edit_profile: 'প্রোফাইল ও সেটিংস পরিবর্তন',
    shop_logo: 'দোকানের লোগো',
    shop_photo: 'দোকানের ছবি',
    owner_signature: 'ডিজিটাল স্বাক্ষর',
    upload_image: 'ছবি আপলোড করুন',
    change_image: 'ছবি পরিবর্তন করুন',
    remove_image: 'মুছে ফেলুন',
    gst_enabled: 'জিএসটি / ট্যাক্স চালুকরণ',
    gst_number: 'জিএসটিIN / ট্রেড লাইসেন্স নম্বর',
    gst_placeholder: 'যেমন: ২২AAAAA০০০০A১Z৫',
    search_country: 'দেশ বা কোড দিয়ে খুঁজুন...',
    select_country: 'দেশ নির্বাচন করুন',
    profile_saved_success: 'দোকানের প্রোফাইল সফলভাবে আপডেট হয়েছে!',
    invalid_phone_error: 'সঠিক মোবাইল নম্বর লিখুন।',
    invalid_otp_error: 'ভুল ওটিপি কোড।',
    customer_added_success: 'নতুন কাস্টমার যোগ করা হয়েছে।',
    clear_keypad: 'মুছুন',
    customer_owes: 'কাস্টমারের বাকি',
    customer_paid: 'কাস্টমার জমা দিয়েছে',
    no_customer_found: 'কোনো কাস্টমার পাওয়া যায়নি।',
    add_customer_prompt: 'উপরে "+ নতুন কাস্টমার" বাটনে চাপ দিন।',
    step_counter: 'ধাপ',
    trusted_tagline: 'সহজ • নিরাপদ • দোকানদারদের বিশ্বস্ত খাতা',
    nav_home: 'হোম',
    nav_customers: 'কাস্টমার',
    nav_history: 'ইতিহাস',
    nav_reports: 'রিপোর্ট',
    nav_profile: 'সেটিংস',
    today: 'আজ',
    this_week: 'এই সপ্তাহ',
    this_month: 'এই মাস',
    all_time: 'সব সময়',
    custom_range: 'নির্দিষ্ট তারিখ',
    date_filter: 'সময়সীমা',
    tx_type_filter: 'লেনদেনের ধরন',
    void_correction: 'সংশোধনী / বাতিল',
    void_transaction: 'লেনদেন সংশোধন করুন',
    void_reason: 'সংশোধনের কারণ',
    void_reason_placeholder: 'যেমন: ভুল টাকার পরিমাণ বা ডুপ্লিকেট এন্ট্রি',
    confirm_void: 'সংশোধনী নিশ্চিত করুন',
    void_notice: 'হিসাব মুছে ফেলা হয় না। এটি অডিট ট্রেইলে একটি রিভার্সাল এন্ট্রি তৈরি করবে।',
    audit_trail: 'অডিট লগ',
    previous_balance: 'পূর্বের বাকি',
    new_balance: 'বর্তমান বাকি',
    reports_title: 'ব্যবসার রিপোর্ট ও হিসাব বিবরণী',
    collection_rate: 'বাকি আদায়ের হার',
    top_due_customers: 'সর্বোচ্চ বাকি থাকা কাস্টমার',
    download_report: 'রিপোর্ট শেয়ার করুন',
    business_summary: 'সামগ্রিক ব্যবসার সারসংক্ষেপ',
    tx_id: 'লেনদেন আইডি',
    no_history_found: 'এই ফিল্টারে কোনো লেনদেনের ইতিহাস পাওয়া যায়নি।',
    recovery_rate: 'আদায়ের দক্ষতা',
    quick_actions: 'দ্রুত কাজ',
    select_gst_rate: 'জিএসটি হার নির্ধারণ (%)',
    customer_state: 'কাস্টমারের রাজ্য/জেলা',
    intra_state_tax: 'রাজ্যের ভেতরের জিএসটি (CGST + SGST)',
    inter_state_tax: 'রাজ্যের বাইরের জিএসটি (IGST)',
    cgst: 'সিজিএসটি (CGST)',
    sgst: 'এসজিএসটি (SGST)',
    igst: 'আইজিএসটি (IGST)',
    base_amount: 'মূল টাকার পরিমাণ',
    tax_amount: 'মোট জিএসটি ট্যাক্স',
    total_with_tax: 'সর্বমোট টাকার পরিমাণ',
    print_receipt: 'রসিদ প্রিন্ট করুন',
    copy_receipt: 'রসিদ কপি করুন',
    receipt_copied: 'রসিদ কপি হয়েছে!',
    share_receipt: 'রসিদ শেয়ার করুন',
    wa_notice: 'হোয়াটসঅ্যাপ খুলবে। অনুগ্রহ করে সেন্ড বাটনে চাপ দিন।',
    download_pdf: 'পিডিএফ ডাউনলোড',
    edit_phone_number: 'নম্বর পরিবর্তন করুন',
    resend_in_seconds: '{seconds} সে. পর আবার পাঠান',
    otp_sent_to: '{phone} নম্বরে ওটিপি পাঠানো হয়েছে',
    receipt_owner: 'মালিক',
    receipt_address: 'ঠিকানা',
    receipt_customer: 'কাস্টমার',
    receipt_thank_you: 'ধন্যবাদ!',
    scan_ledger_page: 'লেজার খাতা স্ক্যান করুন',
    scan_ledger_title: 'এআই হ্যান্ডরাইটিং স্ক্যানার',
    scan_ledger_subtitle: 'হাতে লেখা খাতার পাতার ছবি আপলোড বা টেক করুন',
    upload_ledger_photo: 'ছবি আপলোড করুন',
    ai_processing: 'এআই দিয়ে হাতের লেখা স্ক্যান হচ্ছে...',
    name_detected: 'শনাক্তকৃত কাস্টমারের নাম:',
    amount_detected: 'শনাক্তকৃত টাকা:',
    matched_customer: 'মিল পাওয়া কাস্টমার:',
    select_matching_customer: 'একাধিক মিল পাওয়া কাস্টমার:',
    create_new_customer_prompt: 'মিল পাওয়া যায়নি। নতুন কাস্টমার তৈরি করুন:',
    confirm_and_save: 'নিশ্চিত করুন ও সেভ করুন',
    ledger_photo_proof: 'হাতে লেখা খাতার ছবি প্রমাণ',
    continue_with_google: 'Google দিয়ে এগিয়ে যান',
    or_sign_in_with: 'অথবা সাইন ইন করুন',
    welcome_back_account: 'আবার স্বাগতম ({email})',
    google_signin_error: 'Google সাইন-ইন সম্পূর্ণ করা যায়নি। আবার চেষ্টা করুন।',
    continue_as: '{name} হিসেবে এগিয়ে যান',
  },
  hi: {
    app_title: 'स्मार्ट खाता',
    tagline: 'डिजिटल उधार और बही खाता',
    welcome_title: 'आपके व्यापार के लिए स्मार्ट खाता',
    welcome_subtitle: 'दुकानदारों और छोटे व्यापारियों के लिए सबसे सरल डिजिटल बही खाता।',
    welcome_benefit1: 'कागज़ी खातों के झंझट से मुक्ति और 100% सटीक हिसाब रखें',
    welcome_benefit2: 'हर लेन-देन पर ग्राहक को तुरंत व्हाट्सएप रसीद भेजें',
    welcome_benefit3: 'अपनी भाषा में 100% आसान — बांग्ला, अंग्रेजी या हिंदी',
    get_started: 'शुरू करें',
    select_language: 'ऐप की भाषा चुनें',
    language_subtitle: 'आगे बढ़ने के लिए अपनी पसंदीदा भाषा चुनें',
    english: 'English',
    bangla: 'বাংলা (Bangla)',
    hindi: 'हिंदी (Hindi)',
    phone_login: 'मोबाइल नंबर से लॉगिन',
    enter_mobile: 'लॉगिन करने के लिए अपना नंबर दर्ज करें',
    mobile_placeholder: '9800000000',
    send_otp: 'ओटीपी (OTP) भेजें',
    enter_otp: '6-अंकों का ओटीपी दर्ज करें',
    verify_otp: 'सत्यापित करें और लॉगिन',
    resend_otp: 'पुनः ओटीपी भेजें',
    welcome: 'स्मार्ट खाता में आपका स्वागत है!',
    setup_shop_title: 'अपनी दुकान का प्रोफाइल सेट करें',
    shop_name: 'दुकान का नाम',
    shop_name_placeholder: 'दुकान का नाम दर्ज करें',
    owner_name: 'दुकानदार का नाम',
    owner_name_placeholder: 'अपना नाम दर्ज करें',
    phone_number: 'मोबाइल नंबर',
    whatsapp_number: 'व्हाट्सएप नंबर',
    email_optional: 'ईमेल पता (वैकल्पिक)',
    business_type: 'व्यापार की श्रेणी',
    business_type_placeholder: 'उदा. किराना, मेडिकल, कपड़ों की दुकान',
    country: 'देश',
    state_district: 'राज्य / जिला',
    city: 'शहर / नगर',
    full_address: 'दुकान का पूरा पता',
    postal_code: 'पिन कोड',
    currency_code: 'मुद्रा',
    save_continue: 'सहेजें और आगे बढ़ें',
    save_profile: 'प्रोफ़ाइल सहेजें',
    total_due: 'कुल बाकी उधार',
    total_collected: 'कुल जमा मिला',
    total_customers: 'कुल ग्राहक',
    search_placeholder: 'नाम या मोबाइल नंबर से खोजें...',
    add_new_transaction: 'नया लेन-देन',
    add_customer: 'नया ग्राहक जोड़ें',
    customer_name: 'ग्राहक का नाम',
    customer_phone: 'ग्राहक का मोबाइल नंबर',
    name_placeholder: 'ग्राहक का नाम दर्ज करें',
    phone_placeholder: '9800000000',
    duplicate_name_warning: '"{name}" नाम का ग्राहक पहले से है। पहचान आसान बनाने के लिए नाम में क्षेत्र, पिता का नाम या मोबाइल नंबर के आखिरी 4 अंक जोड़ें।',
    auto_label_info: 'विशिष्ट नाम बनाया गया:',
    select_customer: 'ग्राहक चुनें',
    amount: 'राशि दर्ज करें',
    credit_given: 'उधार दिया',
    payment_received: 'जमा मिला',
    note_optional: 'नोट / सामान का विवरण (वैकल्पिक)',
    save_transaction: 'लेन-देन सेव करें',
    receipt_title: 'लेन-देन की रसीद',
    send_whatsapp: 'व्हाट्सएप पर रसीद भेजें',
    due_amount: 'वर्तमान बकाया',
    all_settled: 'सब चुकता',
    owe_money: 'उधार बाकी है',
    paid_up: 'चुकता / क्लियर',
    transaction_history: 'लेन-देन का इतिहास',
    no_transactions: 'इस ग्राहक का कोई लेन-देन नहीं मिला।',
    send_again: 'फिर से रसीद भेजें',
    date: 'तिथि और समय',
    type: 'लेन-देन का प्रकार',
    back: 'वापस जाएँ',
    logout: 'लॉगआउट',
    currency_symbol: '₹',
    currency_name: 'रुपया',
    all: 'सभी',
    owes_you: 'उधार बाकी',
    all_clear: 'चुका दिया',
    change_lang: 'भाषा',
    demo_mode: 'डेमो मोड',
    demo_notice: 'डेमो मोड में चल रहा है। असली डेटा के लिए .env सेट करें।',
    dev_mode_title: 'डेवलपमेंट मोड',
    dev_mode_sub: 'बिना एसएमएस के किसी भी 6-अंकों के ओटीपी से लॉगिन करें',
    profile_title: 'दुकानदार का प्रोफ़ाइल',
    edit_profile: 'प्रोफ़ाइल और सेटिंग्स बदलें',
    shop_logo: 'दुकान का लोगो',
    shop_photo: 'दुकान की फोटो',
    owner_signature: 'डिजिटल हस्ताक्षर',
    upload_image: 'फोटो अपलोड करें',
    change_image: 'फोटो बदलें',
    remove_image: 'हटाएं',
    gst_enabled: 'जीएसटी / व्यापार लाइसेंस चालू करें',
    gst_number: 'जीएसटीIN / लाइसेंस नंबर',
    gst_placeholder: 'उदा. 22AAAAA0000A1Z5',
    search_country: 'देश या कोड से खोजें...',
    select_country: 'देश चुनें',
    profile_saved_success: 'दुकान का प्रोफ़ाइल सफलतापूर्वक अपडेट हुआ!',
    invalid_phone_error: 'कृपया सही मोबाइल नंबर दर्ज करें।',
    invalid_otp_error: 'गलत ओटीपी कोड।',
    customer_added_success: 'नया ग्राहक सफलतापूर्वक जोड़ा गया।',
    clear_keypad: 'साफ करें',
    customer_owes: 'ग्राहक का उधार',
    customer_paid: 'ग्राहक ने जमा किया',
    no_customer_found: 'कोई ग्राहक नहीं मिला।',
    add_customer_prompt: 'ऊपर "+ नया ग्राहक" पर टैप करें।',
    step_counter: 'चरण',
    trusted_tagline: 'सरल • सुरक्षित • दुकानदारों का विश्वसनीय खाता',
    nav_home: 'होम',
    nav_customers: 'ग्राहक',
    nav_history: 'इतिहास',
    nav_reports: 'रिपोर्ट',
    nav_profile: 'सेटिंग्स',
    today: 'आज',
    this_week: 'इस सप्ताह',
    this_month: 'इस महीने',
    all_time: 'कुल समय',
    custom_range: 'कस्टम तारीख',
    date_filter: 'समय सीमा',
    tx_type_filter: 'लेन-देन का प्रकार',
    void_correction: 'सुधार / रद्द',
    void_transaction: 'लेन-देन में सुधार करें',
    void_reason: 'सुधार का कारण',
    void_reason_placeholder: 'उदा. गलत राशि दर्ज हो गई या दोबारा प्रविष्टि',
    confirm_void: 'सुधार की पुष्टि करें',
    void_notice: 'वित्तीय इतिहास हटाया नहीं जाता। यह ऑडिट ट्रेल में एक सुधार प्रविष्टि बनाएगा।',
    audit_trail: 'ऑडिट लॉग',
    previous_balance: 'पिछला बकाया',
    new_balance: 'नया बकाया',
    reports_title: 'व्यापार रिपोर्ट और विवरण',
    collection_rate: 'उधार वसूली दर',
    top_due_customers: 'शीर्ष बकाया ग्राहक',
    download_report: 'रिपोर्ट शेयर करें',
    business_summary: 'कुल व्यापार का सारांश',
    tx_id: 'लेन-देन आईडी',
    no_history_found: 'इस फ़िल्टर से कोई लेन-देन इतिहास नहीं मिला।',
    recovery_rate: 'वसूली दर',
    quick_actions: 'त्वरित कार्य',
    select_gst_rate: 'जीएसटी दर चुनें (%)',
    customer_state: 'ग्राहक का राज्य/जिला',
    intra_state_tax: 'राज्य के भीतर जीएसटी (CGST + SGST)',
    inter_state_tax: 'राज्य के बाहर जीएसटी (IGST)',
    cgst: 'सीजीएसटी (CGST)',
    sgst: 'एसजीएसटी (SGST)',
    igst: 'आईजीएसटी (IGST)',
    base_amount: 'मूल राशि',
    tax_amount: 'कुल जीएसटी कर',
    total_with_tax: 'कुल राशि (कर सहित)',
    print_receipt: 'प्रिंट रसीद',
    copy_receipt: 'रसीद कॉपी करें',
    receipt_copied: 'रसीद कॉपी हो गई!',
    share_receipt: 'रसीद शेयर करें',
    wa_notice: 'व्हाट्सएप खुलेगा। कृपया सेंड बटन दबाएं।',
    download_pdf: 'पीडीएफ डाउनलोड',
    edit_phone_number: 'नंबर बदलें',
    resend_in_seconds: '{seconds} से. में पुनः भेजें',
    otp_sent_to: '{phone} पर ओटीपी भेजा गया',
    receipt_owner: 'मालिक',
    receipt_address: 'पता',
    receipt_customer: 'ग्राहक',
    receipt_thank_you: 'धन्यवाद!',
    scan_ledger_page: 'खाता पन्ना स्कैन करें',
    scan_ledger_title: 'एआई हैंडराइटिंग स्कैनर',
    scan_ledger_subtitle: 'हाथ से लिखे खाता पन्नों की फोटो अपलोड करें',
    upload_ledger_photo: 'फोटो अपलोड करें',
    ai_processing: 'एआई से लिखावट स्कैन हो रही है...',
    name_detected: 'पहचाना गया नाम:',
    amount_detected: 'पहचानी गई राशि:',
    matched_customer: 'मिला हुआ ग्राहक:',
    select_matching_customer: 'कई मिलते-जुलते ग्राहक मिले:',
    create_new_customer_prompt: 'कोई ग्राहक नहीं मिला। नया ग्राहक बनाएं:',
    confirm_and_save: 'पुष्टि करें और सहेजें',
    ledger_photo_proof: 'हाथ से लिखे पन्ने का सबूत',
    continue_with_google: 'Google से आगे बढ़ें',
    or_sign_in_with: 'या इससे साइन इन करें',
    welcome_back_account: 'वापसी पर स्वागत है ({email})',
    google_signin_error: 'Google साइन-इन पूरा नहीं हो सका। कृपया फिर से प्रयास करें।',
    continue_as: '{name} के रूप में आगे बढ़ें',
  },
};
