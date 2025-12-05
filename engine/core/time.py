class GameTime:
    def __init__(self, year=1, season=0, day=1, hour=8, minute=0):
        self.year = year
        self.season_idx = season  # 0=Spring, 1=Summer, 2=Autumn, 3=Winter
        self.day = day
        self.hour = hour
        self.minute = minute
        
        self.seasons = ["Spring", "Summer", "Autumn", "Winter"]
        self.days_per_month = 30
        
    def advance(self, minutes=0):
        self.minute += minutes
        while self.minute >= 60:
            self.minute -= 60
            self.hour += 1
            
        while self.hour >= 24:
            self.hour -= 24
            self.day += 1
            
        while self.day > self.days_per_month:
            self.day = 1
            self.season_idx += 1
            
        while self.season_idx >= 4:
            self.season_idx = 0
            self.year += 1
            
    def get_season_name(self):
        return self.seasons[self.season_idx]
        
    def is_night(self):
        return self.hour >= 20 or self.hour < 6
        
    def is_day(self):
        return not self.is_night()
        
    def __str__(self):
        return f"{self.hour:02d}:{self.minute:02d}, Day {self.day} of {self.get_season_name()}, Year {self.year}"
    
    def to_dict(self):
        return {
            "year": self.year,
            "season": self.season_idx,
            "day": self.day,
            "hour": self.hour,
            "minute": self.minute,
            "display": str(self),
            "is_night": self.is_night()
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            year=data.get("year", 1),
            season=data.get("season", 0),
            day=data.get("day", 1),
            hour=data.get("hour", 8),
            minute=data.get("minute", 0)
        )
