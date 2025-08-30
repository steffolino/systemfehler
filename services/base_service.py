from abc import ABC, abstractmethod

class BaseService(ABC):
    def __init__(self, **config):
        self.config = config

    def configure(self, **config):
        self.config.update(config)
        self.config.update(config)
