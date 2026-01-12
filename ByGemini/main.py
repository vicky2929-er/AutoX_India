import time
import subprocess
import sys
from colorama import Fore, Style, init

init(autoreset=True)

def run_step(script_name, step_name):
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.YELLOW}🚀 STARTING STEP: {step_name} ({script_name})")
    print(f"{Fore.CYAN}{'='*60}")
    
    start_time = time.time()
    
    # Run the script and wait for it to finish
    try:
        result = subprocess.run([sys.executable, script_name], check=True)
        
        duration = time.time() - start_time
        print(f"\n{Fore.GREEN}✅ {step_name} COMPLETED in {duration:.2f}s")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n{Fore.RED}❌ ERROR in {step_name}. Exit Code: {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"\n{Fore.RED}❌ ERROR: File '{script_name}' not found.")
        return False

def main():
    print(f"{Fore.WHITE}{Style.BRIGHT}🇮🇳 AUTOX INDIA - DAILY AUTOMATION SEQUENCE 🇮🇳")
    
    # --- SEQUENCE ---
    
    # Step 1: Sentinel (Scrape)
    if not run_step("sentinel.py", "Step 1: Data Collection"):
        print(f"{Fore.RED}Stopping due to error in Step 1.")
        return

    # Step 2: Processor (Filter)
    if not run_step("processor.py", "Step 2: Scoring & Filtering"):
        print(f"{Fore.RED}Stopping due to error in Step 2.")
        return

    # Step 3: Generator (AI Writing)
    if not run_step("generator.py", "Step 3: AI Generation"):
        print(f"{Fore.RED}Stopping due to error in Step 3.")
        return

    # Step 4: Enhancer (Images & Retweets)
    if not run_step("enhancer.py", "Step 4: Intelligence Enhancement"):
        print(f"{Fore.RED}Stopping due to error in Step 4.")
        return

    # Step 5: Dashboard (UI)
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.GREEN}🎉 PIPELINE SUCCESSFUL! STARTING DASHBOARD...")
    print(f"{Fore.CYAN}{'='*60}")
    
    try:
        # We don't use subprocess.run here because dashboard needs to stay open
        subprocess.run([sys.executable, "dashboard.py"])
    except KeyboardInterrupt:
        print("\n👋 Dashboard closed.")

if __name__ == "__main__":
    main()