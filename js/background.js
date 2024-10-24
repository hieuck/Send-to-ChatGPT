// Tạo menu chuột phải khi tiện ích được cài đặt hoặc khởi động
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

// Xử lý thông điệp từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "createContextMenus") {
      createContextMenus();
  }
});

// Tạo hoặc cập nhật menu chuột phải với ngôn ngữ đã chọn
function createContextMenus() {
  chrome.storage.local.get(["selectedLanguage", "customLanguage"], (data) => {
      const language = data.customLanguage || data.selectedLanguage || "VI-VN";
      
      // Lấy tên ngôn ngữ từ mã ngôn ngữ
      const languageNames = {
          "VI-VN": "Tiếng Việt",
          "EN-US": "Tiếng Anh (Mỹ)",
          "EN-GB": "Tiếng Anh (Vương quốc Anh)",
          "FR-FR": "Tiếng Pháp (Pháp)",
          "FR-CA": "Tiếng Pháp (Canada)",
          "ES-ES": "Tiếng Tây Ban Nha (Tây Ban Nha)",
          "ES-MX": "Tiếng Tây Ban Nha (Mexico)",
          "DE-DE": "Tiếng Đức",
          "IT-IT": "Tiếng Ý",
          "PT-PT": "Tiếng Bồ Đào Nha (Bồ Đào Nha)",
          "PT-BR": "Tiếng Bồ Đào Nha (Brazil)",
          "JA-JP": "Tiếng Nhật",
          "ZH-CN": "Tiếng Trung (Giản thể)",
          "ZH-TW": "Tiếng Trung (Phồn thể)",
          "RU-RU": "Tiếng Nga",
          "AR-SA": "Tiếng Ả Rập (Saudi Arabia)",
          "KO-KR": "Tiếng Hàn",
          "TR-TR": "Tiếng Thổ Nhĩ Kỳ",
          "NL-NL": "Tiếng Hà Lan",
          "SV-SE": "Tiếng Thụy Điển",
          "DA-DK": "Tiếng Đan Mạch",
          "NO-NO": "Tiếng Na Uy",
          "FI-FI": "Tiếng Phần Lan"
      };

      // Lấy tên ngôn ngữ tương ứng
      const languageName = languageNames[language] || "Ngôn ngữ không xác định. đang sử dụng VI-VN";

      // Cập nhật tiêu đề menu theo ngôn ngữ đã chọn
      const textMenuTitle = chrome.i18n.getMessage("contextMenuText").replace("{language}", languageName + " \"" + language + "\"");
      const linkMenuTitle = chrome.i18n.getMessage("contextMenuLink").replace("{language}", languageName + " \"" + language + "\"");
      
      // Xóa các menu cũ trước khi tạo mới
      chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create({
              id: "sendToChatGPTText",
              title: textMenuTitle,
              contexts: ["selection"]
          });

          chrome.contextMenus.create({
              id: "sendToChatGPTLink",
              title: linkMenuTitle,
              contexts: ["page", "link"]
          });
      });
  });
}

// Theo dõi sự thay đổi trong chrome.storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
      if (changes.selectedLanguage || changes.customLanguage || changes.customLink) {
          createContextMenus(); // Cập nhật menu khi ngôn ngữ hoặc customLink thay đổi
      }
  }
});

// Xử lý khi người dùng nhấp vào menu chuột phải
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.get(["selectedLanguage", "customLanguage", "customLink"], (data) => {
      const language = data.customLanguage || data.selectedLanguage || "VI"; // Dùng ngôn ngữ tùy chỉnh nếu có, nếu không thì dùng từ dropdown
      const customLink = data.customLink || "https://chatgpt.com/?model=auto"; // Link tùy chỉnh hoặc mặc định

      if (info.menuItemId === "sendToChatGPTText" && info.selectionText) {
          sendTextToChatGPT(info.selectionText, language, customLink);
      } else if (info.menuItemId === "sendToChatGPTLink") {
          const pageUrl = info.linkUrl || tab.url;
          sendTextToChatGPT(pageUrl, language, customLink);
      }
  });
});

// Hàm gửi văn bản hoặc liên kết tới ChatGPT với ngôn ngữ đã chọn
function sendTextToChatGPT(text, language, customLink) {
    chrome.storage.local.get(["customPrompt"], (data) => {
        const customPrompt = data.customPrompt || "Answer relevant content in"; // Giá trị mặc định nếu không có nội dung tùy chỉnh
        const fullText = `${customPrompt} ${language}. \n\n${text}`; // Sử dụng customPrompt thay cho đoạn văn bản cứng
  
        chrome.tabs.create({ url: customLink }, (newTab) => { // Sử dụng customLink thay vì link cố định
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === newTab.id && info.status === 'complete') {
                    chrome.scripting.executeScript({
                        target: { tabId: newTab.id },
                        func: (text, language, customPrompt) => {
                            const checkTextarea = setInterval(() => {
                                const inputFieldXPath = '//*[@id="prompt-textarea"]';
                                const inputField = document.evaluate(inputFieldXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  
                                if (inputField) {
                                    const fullText = `${customPrompt} ${language}. \n\n${text}`; // Sử dụng fullText đã cập nhật
                                    inputField.innerText = fullText;
                                    inputField.dispatchEvent(new Event('input', { bubbles: true }));
  
                                    const sendButtonXPath = '//*[@data-testid="send-button"]';
                                    const sendButton = document.evaluate(sendButtonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  
                                    if (sendButton) {
                                        setTimeout(() => {
                                            sendButton.click();
                                            clearInterval(checkTextarea);
                                        }, 500);
                                    }
                                }
                            }, 100);
                        },
                        args: [text, language, customPrompt] // Cần cập nhật args để chứa customPrompt nếu cần
                    });
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        });
    });
}
