import time
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# Configuration
SELENIUM_HUB_URL = "http://localhost:4444/wd/hub"
NOTEBOOK_ID = "b554f156-f548-4adb-97c6-ff4433e285b7"
NOTEBOOK_URL = f"https://notebooklm.google.com/notebook/{NOTEBOOK_ID}"
KEYWORD = "CMP"

def setup_driver():
    print(f"Connecting to Selenium Hub at {SELENIUM_HUB_URL}...")
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--start-maximized")
    
    # Critical for persistence
    chrome_options.add_argument("--user-data-dir=/data")
    chrome_options.add_argument("--profile-directory=Default")
    
    # Explicitly set display for VNC visibility
    chrome_options.add_argument("--display=:99.0")

    driver = webdriver.Remote(
        command_executor=SELENIUM_HUB_URL,
        options=chrome_options
    )
    return driver

def main():
    driver = None
    try:
        driver = setup_driver()
        print(f"Navigating to {NOTEBOOK_URL}...")
        driver.get(NOTEBOOK_URL)
        
        # Wait for page load
        print("Waiting for page load...")
        time.sleep(5)
        
        # Check login
        if "accounts.google.com" in driver.current_url:
            print("Redirected to login page. Please login via VNC (http://localhost:7900).")
            # Keep open for login
            print("Keeping browser open indefinitely for login...")
            while True:
                time.sleep(10)
        
        print(f"Looking for sources containing '{KEYWORD}'...")
        
        # Wait for any source text to appear (proxy for sources loaded)
        wait = WebDriverWait(driver, 30)
        
        # XPath to find ANY element text containing the keyword
        # We target likely source title containers (divs, spans) to avoid body text if possible,
        # but broadly searching text nodes is safer if structure is unknown.
        xpath_locator = f"//*[contains(text(), '{KEYWORD}')]"
        print(f"Using XPath: {xpath_locator}")
        
        try:
             # Find ALL matches
             elements = wait.until(EC.presence_of_all_elements_located((By.XPATH, xpath_locator)))
             print(f"Found {len(elements)} elements containing '{KEYWORD}'.")
             
             for i, element in enumerate(elements):
                 try:
                     print(f"Processing match {i+1}: Tag={element.tag_name}, Text='{element.text}'")
                     
                     # Highlight
                     driver.execute_script("arguments[0].style.border='3px solid red'", element)
                     
                     # Click strategy
                     try:
                         # Look for nearby checkbox
                         parent = element.find_element(By.XPATH, "./..")
                         grandparent = parent.find_element(By.XPATH, "./..")
                         checkboxes = grandparent.find_elements(By.CSS_SELECTOR, "mat-checkbox, input[type='checkbox'], [role='checkbox']")
                         
                         if checkboxes:
                             print("Found checkbox nearby. Clicking...")
                             checkboxes[0].click()
                         else:
                             print("No checkbox found. Clicking element text...")
                             element.click()
                             
                         time.sleep(1) # Small pause between clicks
                         
                     except Exception as click_err:
                         print(f"Error clicking match {i+1}: {click_err}")
                         
                 except Exception as elem_err:
                     print(f"Error processing element {i+1}: {elem_err}")
             
             print("Selection interaction completed.")
             print("Keeping browser open indefinitely (session will persist)...")
             
             # Prevent script exit closing the browser (though we commented out quit below)
             # But if python exits, the remote session might timeout if not interacting?
             # No, standard Selenium Remote sessions persist until deleted or timeout.
             
        except Exception as e:
            print(f"Could not find any source elements matching '{KEYWORD}': {e}")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if driver:
            print("Skipping driver.quit() to keep browser open in VNC.")
            # driver.quit()

if __name__ == "__main__":
    main()
