import re
from jinja2 import Environment, BaseLoader
from engine.core.state import GameState
from engine.core import functions

class GameParser:
    def __init__(self, state: GameState):
        self.state = state
        self.env = Environment(loader=BaseLoader())
        
        # Register all game functions as Jinja globals/filters
        for name, func in functions.REGISTRY.items():
            # We wrap them to inject state automatically
            self.env.globals[name] = self._create_wrapper(func)
            
        # Add state variables to context
        self.env.globals["player"] = self.state.player
        self.env.globals["flags"] = self.state.flags
        self.env.globals["time"] = self.state.time
        self.env.globals["inventory"] = self.state.inventory
        
    def _create_wrapper(self, func):
        def wrapper(*args):
            return func(self.state, *args)
        return wrapper

    def parse(self, text: str) -> str:
        if not text:
            return ""
            
        # 1. Handle custom one-line syntax {{func arg1 arg2}} if strictly needed, 
        # but Jinja handles {{ func(arg1, arg2) }} better.
        # The user asked for {{give_gold 500}} style.
        # We can pre-process that to {{ give_gold(500) }} for Jinja.
        
        # Regex to transform {{func arg1 arg2}} -> {{ func(arg1, arg2) }}
        # This is a bit tricky to get perfect, so we might rely on standard Jinja syntax
        # OR we implement a simple pre-processor.
        
        # Let's try to support the user's requested syntax: {{give_gold 500}}
        # We look for {{identifier space args}}
        
        def replacer(match):
            content = match.group(1).strip()
            parts = content.split(' ')
            func_name = parts[0]
            args = parts[1:]
            
            # If it looks like a function call we know
            if func_name in functions.REGISTRY:
                # Quote string args if they aren't numbers or booleans
                formatted_args = []
                for arg in args:
                    if arg.isdigit():
                        formatted_args.append(arg)
                    elif arg.lower() in ['true', 'false']:
                        formatted_args.append(arg.title())
                    elif (arg.startswith('"') and arg.endswith('"')) or (arg.startswith("'") and arg.endswith("'")):
                        formatted_args.append(arg)
                    else:
                        # Assume string if not variable look up... 
                        # Actually, in Jinja, unquoted is a variable.
                        # But for "give_gold 500", 500 is int.
                        # "travel_to town" -> town might be string 'town'.
                        # Let's quote it if it's not a known variable? 
                        # Safer to just let user use Jinja syntax if they want variables,
                        # but for the simple syntax, we treat non-numbers as strings.
                        formatted_args.append(f"'{arg}'")
                
                return f"{{{{ {func_name}({', '.join(formatted_args)}) }}}}"
            
            return match.group(0) # No change

        # Apply pre-processing for simple syntax
        # Pattern: {{ word args... }}
        # We only want to touch things that look like function calls, not {{ if ... }}
        # text = re.sub(r'\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*\s+[^}]+)\s*\}\}', replacer, text)
        
        # Actually, let's just use standard Jinja for now to ensure robustness, 
        # and maybe add the simple syntax support if we have time. 
        # The user's example {{give_gold 500}} is technically valid Jinja if give_gold is a macro, 
        # but usually it's {{ give_gold(500) }}.
        # Wait, the user explicitly asked for "One-line function calls like {{give_gold 500}}".
        # I will implement a regex fix for this specific pattern.
        
        processed_text = text
        
        # Find all {{ ... }} blocks
        matches = re.finditer(r'\{\{(.*?)\}\}', text)
        offset = 0
        for m in matches:
            raw_content = m.group(1).strip()
            parts = raw_content.split()
            if not parts: continue
            
            cmd = parts[0]
            if cmd in functions.REGISTRY:
                # It's a function call in simplified syntax
                args = parts[1:]
                # Quote args that look like strings
                new_args = []
                for arg in args:
                    if arg.replace('.','',1).isdigit():
                        new_args.append(arg)
                    elif arg.lower() in ['true', 'false']:
                        new_args.append(arg.title())
                    elif arg.startswith('"') or arg.startswith("'"):
                        new_args.append(arg)
                    else:
                        new_args.append(f"'{arg}'")
                        
                new_block = f"{{{{ {cmd}({', '.join(new_args)}) }}}}"
                
                # Replace in text
                start, end = m.span()
                processed_text = processed_text[:start+offset] + new_block + processed_text[end+offset:]
                offset += len(new_block) - len(m.group(0))

        try:
            template = self.env.from_string(processed_text)
            return template.render()
        except Exception as e:
            return f"[Template Error: {e}]"

