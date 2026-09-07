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
SOURCE_TITLE_PARTIAL = "CData SAP Driver Deep Dive"

def setup_driver():
    print(f"Connecting to Selenium Hub at {SELENIUM_HUB_URL}...")
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # chrome_options.add_argument("--headless") # Check if we want headless or not. Usually better to see it via VNC.
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
            # We can't automate login easily if it requires 2FA etc, but user said 'done' to auth.
            # Wait a bit to see if it redirects back?
            time.sleep(5)
        
        # Look for Sources panel
        # Try to find the source text directly
        print(f"Looking for source containing '{SOURCE_TITLE_PARTIAL}'...")
        
        # Wait for any source text to appear (proxy for sources loaded)
        wait = WebDriverWait(driver, 30)
        
        # Strategy: Find element containing text, then find preceding checkbox
        # NotebookLM structure usually:
        # Checkbox -> Title
        # or Row -> Checkbox + Title
        
        xpath_locator = f"//*[contains(text(), '{SOURCE_TITLE_PARTIAL}')]"
        print(f"Using XPath: {xpath_locator}")
        
        try:
             element = wait.until(EC.presence_of_element_located((By.XPATH, xpath_locator)))
             print("Found source title element.")
             
             # Locate the container row or checkbox relative to this
             # Often the checkbox is an <input type="checkbox"> or a <div role="checkbox"> nearby
             # Traverse up to find the row
             
             # Let's try to find an input/checkbox ancestor or sibling
             # Assuming structure: Row > [Checkbox] [Title]
             
             # Highlight element for debug (in VNC)
             driver.execute_script("arguments[0].style.border='3px solid red'", element)
             
             # Look for the checkbox.
             # It might be an 'md-checkbox' or similar. 
             # Let's try clicking the title first, sometimes that toggles it or opens it.
             # But user wants to SELECT it for query context.
             
             # In new UI, there are checkboxes next to sources in the source list.
             # XPath for checkbox preceding the text:
             # //*[contains(text(), 'Title')]/preceding-sibling::*[contains(@class, 'checkbox')] 
             # or traverse up to row and find checkbox.
             
             # Let's try to click the element itself first, looking for a checkbox 
             # relative to it is hard without DOM.
             
             # PROBE: Print accessible name or role
             print(f"Tag: {element.tag_name}, Text: {element.text}")
             
             # Try to find a checkbox nearby
             try:
                 # Look for a checkbox control in the vicinity (parent's parent?)
                 parent = element.find_element(By.XPATH, "./..")
                 grandparent = parent.find_element(By.XPATH, "./..")
                 
                 # Look for check_box icon or input
                 checkboxes = grandparent.find_elements(By.CSS_SELECTOR, "mat-checkbox, input[type='checkbox'], [role='checkbox']")
                 if checkboxes:
                     print(f"Found {len(checkboxes)} potential checkboxes nearby.")
                     checkboxes[0].click()
                     print("Clicked the first nearby checkbox.")
                 else:
                     print("No specific checkbox found nearby. Clicking the title element itself as fallback.")
                     element.click()
                     
             except Exception as e:
                 print(f"Error finding nearby checkbox: {e}")
                 print("Clicking title element...")
                 element.click()

             print("Interaction attempted.")
             
             # Keep open for a moment to verify
             print("Keeping browser open indefinitely (session will persist)...")
             # time.sleep(30)
             
        except Exception as e:
            print(f"Could not find source element: {e}")
            # Dump page source for debug if needed
            # print(driver.page_source[:1000])

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if driver:
            print("Skipping driver.quit() to keep browser open in VNC.")
            # driver.quit()

if __name__ == "__main__":
    main()
